const mongoose = require('mongoose');
const { appConfig } = require('./appConfig');

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB.
 * We fail fast on startup errors so deployment does not run in half-broken state.
 */
const connectDB = async () => {
    try {
        await mongoose.connect(appConfig.mongoUri, {
            maxPoolSize: 20,
            minPoolSize: appConfig.isProduction ? 5 : 0,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4,
        });
        console.log('MongoDB connected successfully.');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
