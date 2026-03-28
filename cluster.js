const cluster = require('cluster');
const os = require('os');

const { appConfig } = require('./config/appConfig');
const { startServer } = require('./server');

function getAvailableCpuCount() {
    if (typeof os.availableParallelism === 'function') {
        return os.availableParallelism();
    }

    return os.cpus().length;
}

function resolveWorkerCount() {
    const explicitCount = Number(process.env.WEB_CONCURRENCY || process.env.CLUSTER_WORKERS || 0);
    if (explicitCount > 0) {
        return explicitCount;
    }

    if (!appConfig.isProduction) {
        return 1;
    }

    // Railway-style small instances benefit from clustering, but 1 GB RAM can get
    // tight if we spawn too many Node workers. Defaulting to max 2 workers keeps
    // memory practical while still using multiple vCPUs.
    return Math.max(1, Math.min(getAvailableCpuCount(), 2));
}

async function startWorker() {
    try {
        await startServer();
    } catch (error) {
        console.error(`Worker ${process.pid} failed to start:`, error);
        process.exit(1);
    }
}

function startPrimary() {
    const workerCount = resolveWorkerCount();
    let isShuttingDown = false;

    console.log(`Primary ${process.pid} starting ${workerCount} worker(s).`);

    const spawnWorker = () => cluster.fork();
    for (let index = 0; index < workerCount; index += 1) {
        spawnWorker();
    }

    const shutdown = (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log(`Primary ${process.pid} received ${signal}. Stopping workers...`);
        Object.values(cluster.workers || {}).forEach((worker) => {
            worker?.process.kill(signal);
        });

        setTimeout(() => {
            process.exit(0);
        }, 10000).unref();
    };

    cluster.on('exit', (worker, code, signal) => {
        console.warn(
            `Worker ${worker.process.pid} exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`
        );

        if (!isShuttingDown) {
            spawnWorker();
        }
    });

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
        process.once(signal, () => shutdown(signal));
    });
}

if (cluster.isPrimary) {
    startPrimary();
} else {
    startWorker();
}
