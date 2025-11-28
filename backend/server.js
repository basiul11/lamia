const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
const User = require('./userModel');
const bcrypt = require('bcrypt');

// --- إعدادات أولية ---
dotenv.config(); // لتحميل المتغيرات من ملف .env
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
        // لا نعيد حقل كلمة المرور في الاستجابة لأسباب أمنيّة
        const users = await User.find({}).select('-password').sort({ createdAt: -1 }); // جلب كل المستخدمين من قاعدة البيانات
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

        if (!user) {
            return res.status(401).json({ message: 'رقم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // مقارنة مرنة: إذا كانت كلمة المرور مخزنة كـ bcrypt hash نستخدم compare،
        // أما إذا كانت نصية (من إصدار قديم) فنقارن نصيًا ثم نرحّلها إلى hash عند النجاح.
        const saltRounds = 10;
        let passwordMatch = false;
        if (typeof user.password === 'string' && user.password.startsWith('$2')) {
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // كلمات المرور النصية قد تكون موجودة في قاعدة قديمة
            passwordMatch = user.password === password;
            if (passwordMatch) {
                // ترحيل كلمة المرور إلى نسخة مشفّرة
                try {
                    const hashed = await bcrypt.hash(password, saltRounds);
                    user.password = hashed;
                    await user.save();
                } catch (err) {
                    console.error('Error migrating plaintext password to hash:', err);
                }
            }
        }

        if (passwordMatch) {
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

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({
            userId: newUserId,
            name,
            password: hashedPassword,
            role
        });

        const createdUser = await newUser.save();
        res.status(201).json(createdUser);
    } catch (error) {
        console.error('Add User Error:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند إضافة المستخدم' });
    }
});

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

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            // --- إنشاء مدير افتراضي عند بدء التشغيل (إذا لم يكن موجودًا) ---
            const createDefaultAdmin = async () => {
                const adminExists = await User.findOne({ role: 'مدير' });
                if (!adminExists) {
                    console.log('لم يتم العثور على مدير. جاري إنشاء مدير افتراضي...');
                    try {
                        const saltRounds = 10;
                        const hashed = await bcrypt.hash('admin123', saltRounds);
                        const defaultAdmin = new User({
                            userId: 999,
                            name: 'المدير العام',
                            password: hashed,
                            role: 'مدير'
                        });
                        await defaultAdmin.save();
                    } catch (err) {
                        console.error('Failed to create default admin:', err);
                    }
                    console.log('تم إنشاء المدير الافتراضي بنجاح. رقم المستخدم: 999 | كلمة المرور: admin123');
                }
            };
            createDefaultAdmin();
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
