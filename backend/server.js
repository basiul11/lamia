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

// --- إنشاء مدير افتراضي عند بدء التشغيل (إذا لم يكن موجودًا) ---
const createDefaultAdmin = async () => {
    try {
        // انتظر قليلاً للتأكد من أن الاتصال بقاعدة البيانات قد تم
        await new Promise(resolve => setTimeout(resolve, 3000)); 

        const adminExists = await User.findOne({ role: 'مدير' });
        if (!adminExists) {
            console.log('لم يتم العثور على مدير. جاري إنشاء مدير افتراضي...');
            const defaultAdmin = new User({
                userId: 999,
                name: 'المدير العام',
                password: 'admin123', // ملاحظة: قم بتغيير كلمة المرور هذه بعد أول تسجيل دخول
                role: 'مدير'
            });
            await defaultAdmin.save();
            console.log('تم إنشاء المدير الافتراضي بنجاح. رقم المستخدم: 999 | كلمة المرور: admin123');
        }
    } catch (error) { console.error('خطأ أثناء إنشاء المدير الافتراضي:', error); }
};
createDefaultAdmin();

app.use(express.json()); // لتحليل الطلبات القادمة كـ JSON

// --- إعدادات CORS ---
// في بيئة التطوير، نسمح للجميع بالوصول
// في بيئة الإنتاج (على Railway)، سنحدد رابط Netlify فقط
// رابط موقعك على Netlify
const whitelist = ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://lamia0.netlify.app']; 
const corsOptions = {
  origin: function (origin, callback) {
    // نسمح بالطلبات التي ليس لها origin (مثل Postman أو تطبيقات الموبايل) في بيئة التطوير
    if (!origin || whitelist.indexOf(origin) !== -1) {
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

        // تحويل userId من نص إلى رقم قبل البحث
        const numericUserId = parseInt(userId, 10);

        // التحقق من أن الناتج هو رقم صالح
        if (isNaN(numericUserId)) {
            return res.status(400).json({ message: 'رقم المستخدم يجب أن يكون رقمًا صحيحًا.' });
        }

        const user = await User.findOne({ userId: numericUserId });

        if (user && user.password === password) { // ملاحظة: في تطبيق حقيقي، يجب تشفير كلمات المرور
            res.json({
                message: 'تم تسجيل الدخول بنجاح',
                user: { name: user.name, role: user.role, userId: user.userId }
            });
        } else {
            res.status(401).json({ message: 'رقم المستخدم أو كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        // طباعة الخطأ بالتفصيل في سجلات Render
        console.error('Login Error:', error); 
        res.status(500).json({ message: 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى' });
    }
});

// POST: إضافة مستخدم جديد
app.post('/api/users', async (req, res) => {
    try {
        const { name, password, role } = req.body;

        if (!name || !password || !role) {
            return res.status(400).json({ message: 'الرجاء إدخال جميع الحقول المطلوبة' });
        }

        // إيجاد أعلى userId موجود حاليًا
        const lastUser = await User.findOne().sort({ userId: -1 });
        let newUserId = 1000; // قيمة افتراضية لأول مستخدم
        if (lastUser && lastUser.userId) {
            newUserId = lastUser.userId + 1;
        }

        const newUser = new User({
            userId: newUserId,
            name,
            password, // ملاحظة: يجب تشفير كلمة المرور في تطبيق حقيقي
            role
        });

        const createdUser = await newUser.save();
        res.status(201).json(createdUser);
    } catch (error) {
        console.error('Add User Error:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند إضافة المستخدم' });
    }
});

// GET: جلب الإحصائيات (عدد الطلاب والمعلمين)
app.get('/api/stats', async (req, res) => {
    try {
        const studentCount = await User.countDocuments({ role: 'طالب' });
        const teacherCount = await User.countDocuments({ role: 'معلم' });
        // يمكنك إضافة إحصائيات أخرى هنا مستقبلاً
        res.json({
            studentCount,
            teacherCount,
            subjectCount: 0 // قيمة وهمية حالياً
        });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في الخادم عند جلب الإحصائيات' });
    }
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
