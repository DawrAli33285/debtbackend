const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  console.log("AUTH CALLED")
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log("USER IS")
    console.log(req.user)
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};