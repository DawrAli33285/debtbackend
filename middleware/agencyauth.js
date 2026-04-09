const jwt = require('jsonwebtoken');

const agencyAuth = (req, res, next) => {
  try {
 
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'agency') {
      return res.status(403).json({ message: 'Access denied: not an agency account' });
    }

    req.agencyUser = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = agencyAuth;