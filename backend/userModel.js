const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
    {
        userId: { type: Number, required: true, unique: true },
        name: { type: String, required: true },
        password: { type: String, required: true }, // سيتم تشفيره لاحقًا
        role: {
            type: String,
            required: true,
            enum: ['مدير', 'معلم', 'طالب'], // الأدوار المسموح بها فقط
        },
    },
    { timestamps: true } // لإضافة تاريخ الإنشاء والتحديث تلقائيًا
);

const User = mongoose.model('User', userSchema);

module.exports = User;