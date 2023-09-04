const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoose = require('mongoose');

const Admin = mongoose.model('Admin');

require('dotenv').config({ path: '.variables.env' });

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.connection.remoteAddress;
    let isLocalhost = false;
    if (clientIP === '127.0.0.1' || clientIP === '::1') {
      // Connection is from localhost
      isLocalhost = true;
    }
    // validate
    if (!email || !password)
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Not all fields have been entered.',
      });

    const admin = await Admin.findOne({ email: email, removed: false });
    // console.log(admin);
    if (!admin)
      return res.status(400).json({
        success: false,
        result: null,
        message: 'No account with this email has been registered.',
      });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid credentials.',
      });

    const token = jwt.sign(
      {
        id: admin._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: req.body.remember ? 365 * 24 + 'h' : '24h' }
    );

    const result = await Admin.findOneAndUpdate(
      { _id: admin._id },
      { $set: { isLoggedIn: 1 }, $push: { loggedSessions: token } },
      {
        new: true,
      }
    ).exec();

    res
      .status(200)
      .cookie('token', token, {
        maxAge: req.body.remember ? 365 * 24 * 60 * 60 * 1000 : null, // Cookie expires after 30 days
        sameSite: process.env.NODE_ENV === 'production' && !isLocalhost ? 'Lax' : 'none',
        httpOnly: true,
        secure: true,
        domain: req.hostname,
        Path: '/',
      })
      .json({
        success: true,
        result: {
          token,
          admin: {
            id: result._id,
            name: result.name,
            isLoggedIn: result.isLoggedIn > 0 ? true : false,
          },
        },
        message: 'Successfully login admin',
      });
  } catch (err) {
    res.status(500).json({ success: false, result: null, message: err.message, error: err });
  }
};

module.exports = login;