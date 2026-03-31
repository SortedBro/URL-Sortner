(function () {
  const modal = document.getElementById('feedbackConfirmModal');
  const titleEl = document.getElementById('feedbackConfirmTitle');
  const messageEl = document.getElementById('feedbackConfirmMessage');
  const cancelBtn = document.getElementById('feedbackConfirmCancel');
  const acceptBtn = document.getElementById('feedbackConfirmAccept');
  const toastStack = document.getElementById('feedbackToastStack');

  const fallbackConfirm = async (options) => {
    const message = [options.title, options.message].filter(Boolean).join('\n\n');
    return window.confirm(message || 'Please confirm to continue.');
  };

  const fallbackToast = (message) => {
    if (message) {
      console.info(message);
    }
  };

  if (!modal || !titleEl || !messageEl || !cancelBtn || !acceptBtn || !toastStack) {
    window.snaplinkUI = {
      confirm: fallbackConfirm,
      toast: fallbackToast,
      wireConfirmForms: function () {}
    };
    return;
  }

  let activeResolver = null;
  let activeTrigger = null;

  function closeDialog(result) {
    if (modal.hidden) return;

    modal.hidden = true;
    modal.classList.remove('is-open');
    document.body.classList.remove('feedback-modal-open');

    if (activeTrigger && typeof activeTrigger.focus === 'function') {
      activeTrigger.focus();
    }

    if (activeResolver) {
      activeResolver(result);
    }

    activeResolver = null;
    activeTrigger = null;
  }

  async function confirmDialog(options) {
    const settings = Object.assign({
      title: 'Confirm action',
      message: 'Please confirm to continue.',
      confirmText: 'Continue',
      cancelText: 'Cancel',
      tone: 'default'
    }, options || {});

    titleEl.textContent = settings.title;
    messageEl.textContent = settings.message;
    cancelBtn.textContent = settings.cancelText;
    acceptBtn.textContent = settings.confirmText;
    acceptBtn.classList.remove('feedback-btn--danger', 'feedback-btn--success', 'feedback-btn--accent');
    acceptBtn.classList.add(
      settings.tone === 'danger'
        ? 'feedback-btn--danger'
        : settings.tone === 'success'
          ? 'feedback-btn--success'
          : 'feedback-btn--accent'
    );

    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.classList.add('feedback-modal-open');

    return new Promise((resolve) => {
      activeResolver = resolve;
      activeTrigger = document.activeElement;
      window.requestAnimationFrame(() => acceptBtn.focus());
    });
  }

  function toast(message, options) {
    if (!message) return;
    const settings = Object.assign({ tone: 'default', duration: 2600 }, options || {});
    const item = document.createElement('div');
    item.className = 'feedback-toast feedback-toast--' + settings.tone;
    item.textContent = message;
    toastStack.appendChild(item);

    window.requestAnimationFrame(() => item.classList.add('is-visible'));

    const removeToast = () => {
      item.classList.remove('is-visible');
      window.setTimeout(() => item.remove(), 180);
    };

    window.setTimeout(removeToast, settings.duration);
  }

  function extractConfirmSettings(form, submitter) {
    const source = submitter || form;
    return {
      title: source.dataset.confirmTitle || form.dataset.confirmTitle || 'Confirm action',
      message: source.dataset.confirmMessage || form.dataset.confirmMessage || 'Please confirm to continue.',
      confirmText: source.dataset.confirmConfirm || form.dataset.confirmConfirm || 'Continue',
      cancelText: source.dataset.confirmCancel || form.dataset.confirmCancel || 'Cancel',
      tone: source.dataset.confirmTone || form.dataset.confirmTone || 'default'
    };
  }

  function wireConfirmForms(root) {
    const scope = root || document;

    scope.querySelectorAll('form[data-confirm-dialog]').forEach((form) => {
      if (form.dataset.confirmBound === 'true') return;

      form.addEventListener('submit', async (event) => {
        if (form.dataset.confirmApproved === 'true') {
          delete form.dataset.confirmApproved;
          return;
        }

        event.preventDefault();
        const submitter = event.submitter || document.activeElement;
        const ok = await confirmDialog(extractConfirmSettings(form, submitter));

        if (!ok) return;

        form.dataset.confirmApproved = 'true';
        if (typeof form.requestSubmit === 'function') {
          if (submitter && submitter.form === form) {
            form.requestSubmit(submitter);
          } else {
            form.requestSubmit();
          }
        } else {
          HTMLFormElement.prototype.submit.call(form);
        }
      });

      form.dataset.confirmBound = 'true';
    });
  }

  cancelBtn.addEventListener('click', () => closeDialog(false));
  acceptBtn.addEventListener('click', () => closeDialog(true));
  modal.addEventListener('click', (event) => {
    if (event.target.hasAttribute('data-feedback-close')) {
      closeDialog(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeDialog(false);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wireConfirmForms(document));
  } else {
    wireConfirmForms(document);
  }

  window.snaplinkUI = {
    confirm: confirmDialog,
    toast,
    wireConfirmForms
  };
})();
