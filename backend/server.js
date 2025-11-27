const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
const User = require('./userModel');

// --- إعدادات أولية ---
dotenv.config(); // لتحميل المتغيرات من ملف .env
connectDB(); // للاتصال بقاعدة البيانات
const app = express();
app.use(express.json()); // لتحليل الطلبات القادمة كـ JSON

// --- إعدادات CORS ---
// في بيئة التطوير، نسمح للجميع بالوصول
// في بيئة الإنتاج (على Railway)، سنحدد رابط Netlify فقط
// رابط موقعك على Netlify
const whitelist = ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://lamia0.netlify.app']; 
const corsOptions = {
  origin: function (origin, callback) {
    // نسمح بالطلبات التي ليس لها origin (مثل Postman أو تطبيقات الموبايل) في بيئة التطوير
    if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
    }
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));

// --- تقديم الملفات الثابتة (الواجهة الأمامية) ---
// نجعل الخادم يقدم ملفات HTML من مجلد public
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// --- نقاط الوصول (API Endpoints) ---

// GET: جلب كل المستخدمين
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 }); // جلب كل المستخدمين من قاعدة البيانات
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// POST: تسجيل الدخول
app.post('/api/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
        if (!userId || !password) {
            return res.status(400).json({ message: 'الرجاء إدخال رقم المستخدم وكلمة المرور' });
        }

        const user = await User.findOne({ userId: userId });

        if (user && user.password === password) { // ملاحظة: في تطبيق حقيقي، يجب تشفير كلمات المرور
            res.json({
                message: 'تم تسجيل الدخول بنجاح',
                user: { name: user.name, role: user.role, userId: user.userId }
            });
        } else {
            res.status(401).json({ message: 'رقم المستخدم أو كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// توجيه أي طلب غير معروف إلى صفحة تسجيل الدخول
app.get('*', (req, res) => {
  res.sendFile(path.resolve(publicPath, 'index.html'));
});
