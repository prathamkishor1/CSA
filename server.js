const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Ensure 'uploads' folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Pratham@123',
    database: 'csa_platform'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads')); // Serve uploaded images
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true,
}));

// Set up multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/* ==========================
   Authentication Routes
   ========================== */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/signup.html'));
});

app.post('/signup', (req, res) => {
    const { username, password, role } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).send('Server error');

        if (results.length > 0) {
            return res.status(400).send('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role],
            (err, result) => {
                if (err) return res.status(500).send('Error registering user');
                req.session.user = { id: result.insertId, username, role };
                res.redirect(`/${role}-dashboard`);
            });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).send('Server error');
        if (results.length === 0) return res.status(400).send('Invalid credentials');

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(400).send('Invalid credentials');

        req.session.user = user;
        res.redirect(`/${user.role}-dashboard`);
    });
});

/* ==========================
   Dashboard Routes
   ========================== */
app.get('/farmer-dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'farmer') {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public/farmer-dashboard.html'));
});

app.get('/buyer-dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'buyer') {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public/buyer-dashboard.html'));
});

/* ==========================
   Product Management
   ========================== */
// Add Product
app.post('/add-product', upload.single('productImage'), (req, res) => {
    const { productName, productDescription, productPrice, productQuantity } = req.body;
    const productImage = req.file ? req.file.filename : null;
    const farmer_id = req.session.user ? req.session.user.id : null;

    if (!farmer_id) return res.status(401).send('Unauthorized: Please log in as a farmer.');

    if (!productName || !productDescription || !productPrice || !productQuantity || !productImage) {
        return res.status(400).send('All fields are required!');
    }

    db.query('INSERT INTO products (farmer_id, name, description, price, quantity, image) VALUES (?, ?, ?, ?, ?, ?)',
        [farmer_id, productName, productDescription, productPrice, productQuantity, productImage],
        (err) => {
            if (err) return res.status(500).send('Error adding product');
            res.redirect('/farmer-dashboard');
        });
});

// Fetch Products for Farmer Dashboard
app.get('/farmer-products', (req, res) => {
    const farmerId = req.session.user ? req.session.user.id : null;

    if (!farmerId) return res.status(401).send('Unauthorized');

    db.query('SELECT * FROM products WHERE farmer_id = ?', [farmerId], (err, results) => {
        if (err) return res.status(500).send('Error fetching products');
        res.json(results);
    });
});

// Fetch All Products for Buyers
app.get('/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        if (err) return res.status(500).send('Error fetching products');
        res.json(results);
    });
});

// Delete Product
app.delete('/delete-product/:id', (req, res) => {
    const productId = req.params.id;
    const farmerId = req.session.user ? req.session.user.id : null;

    if (!farmerId) return res.status(401).send('Unauthorized');

    db.query('DELETE FROM products WHERE id = ? AND farmer_id = ?', [productId, farmerId], (err) => {
        if (err) return res.status(500).send('Error deleting product');
        res.send('Product deleted successfully!');
    });
});

/* ==========================
   Order Management
   ========================== */
app.post('/place-order', (req, res) => {
    const { address, contact } = req.body;
    console.log('Order placed:', { address, contact });
    res.send('Order placed successfully!');
});

/* ==========================
   Logout
   ========================== */
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send('Logout failed');
        res.redirect('/');
    });
});

/* ==========================
   Start Server
   ========================== */
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
