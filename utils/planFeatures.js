function isProPlan(plan) {
    return plan === 'pro' || plan === 'business';
}

function isBusinessPlan(plan) {
    return plan === 'business';
}

function getTeamSeatLimit(plan) {
    return isBusinessPlan(plan) ? 5 : 0;
}

module.exports = {
    isProPlan,
    isBusinessPlan,
    getTeamSeatLimit,
};
