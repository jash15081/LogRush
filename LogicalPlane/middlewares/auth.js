import jwt from "jsonwebtoken";

export function authAdmin(req, res, next) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
   
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        error: "Admin privileges required",
      });
    }

    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}


export function authUser(req, res, next) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
   
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}
