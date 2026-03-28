const mongoose = require('mongoose');
const { appConfig } = require('./appConfig');

/**
 * Connects to MongoDB.
 * We fail fast on startup errors so deployment does not run in half-broken state.
 */
const connectDB = async () => {
    try {
        await mongoose.connect(appConfig.mongoUri);
        console.log('MongoDB connected successfully.');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
