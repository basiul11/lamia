const mongoose = require('mongoose');

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    return mongoose.connect(process.env.MONGO_URI).catch(error => {
        console.error(`Database Connection Error: ${error.message}`);
        process.exit(1);
    });
};

module.exports = connectDB;