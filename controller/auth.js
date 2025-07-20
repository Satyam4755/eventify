const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const vender = require("../models/event");
const Orders = require("../models/eventBooking");
const bcrypt = require("bcryptjs");
const cloudinary = require('cloudinary').v2;
const { fileUploadInCloudinary } = require('../utils/cloudinary');
exports.LoginPage = (req, res, next) => {
    // registervenders ka variable me, find() ko call karenge
    const { email, password } = req.body;
    res.render('./store/logIn', {
        title: "Log Page",
        currentPage: 'logIn',
        isLogedIn: req.isLogedIn,
        oldInput: { email, password },
        errorMessage: [],
        user: req.session.user,
    })

}
exports.PostLogin = async (req, res, next) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email })
    if (!user) {
        return res.status(422).render('./store/logIn', {
            title: "Login Page",
            isLogedIn: false,
            currentPage: 'logIn',
            errorMessage: ['Incorrect email or password'],
            oldInput: { email },
            user: {}
        })
    }
    const isMatched = await bcrypt.compare(password, user.password)
    if (!isMatched) {
        return res.status(422).render('./store/logIn', {
            title: "Login Page",
            isLogedIn: false,
            currentPage: 'logIn',
            errorMessage: ['Incorrect email or password'],
            oldInput: { email },
            user: {}
        })
    }
    req.session.isLogedIn = true;
    req.session.user = user;
    await req.session.save();
    if (user.userType === 'organizer') {
        return res.redirect('/vender/events-list')
    }
    res.redirect('/')
}
exports.PostLogout = (req, res, next) => {
    req.session.destroy(() => {
        res.redirect('/logIn')
    })

}
// we can make middleware in array format also....
exports.postSignUpPage = [
  // ✅ Validations
  check('firstName')
    .notEmpty().withMessage("First name should not be empty")
    .trim().isLength({ min: 2 }).withMessage("Name should be greater than 1 character")
    .matches(/^[a-zA-Z]+$/).withMessage("Should be correct name"),

  check('lastName')
  .trim()
    .matches(/^[a-zA-Z]*$/).withMessage("Should be correct name"),

  check('email')
    .isEmail().withMessage("Email should be in email format")
    .normalizeEmail(),

  check('password')
    .isLength({ min: 6 }).withMessage("The password must be at least 6 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase character")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .trim(),

  check('confirmPassword')
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  check('userType')
    .isIn(['attendee', 'organizer']).withMessage("Please select a valid user type"),

  check('terms')
    .custom(value => {
      if (value !== 'on') {
        throw new Error("Please accept the terms and conditions");
      }
      return true;
    }),

  // ✅ Handler
  async (req, res) => {
    const { firstName, lastName,email, password, userType } = req.body;
    const editing = req.query.editing === 'true';
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render('store/signup', {
        title: "Sign-Up",
        isLogedIn: false,
        errorMessage: errors.array().map(err => err.msg),
        oldInput: {
          firstName,
          lastName,
          email,
          password,
          userType
        },
        editing,
        user: {}
      });
    }

    try {
      const files = req.files;
      let profilePictureUrl = '';
      let profilePicturePublicId = '';

      // ✅ Upload only if user provided profile image
      if (files?.profilePicture && files.profilePicture.length > 0) {
        const profilePictureBuffer = files.profilePicture[0].buffer;

        const profilePictureResult = await fileUploadInCloudinary(profilePictureBuffer);

        if (!profilePictureResult?.secure_url) {
          throw new Error("Cloudinary upload failed");
        }

        profilePictureUrl = profilePictureResult.secure_url;
        profilePicturePublicId = profilePictureResult.public_id;
      }

      const hashedPassword = await bcrypt.hash(password, 8);

      const newUser = new User({
        profilePicture: profilePictureUrl,
        profilePicturePublicId: profilePicturePublicId,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        userType,
      });

      const user = await newUser.save();

      req.session.isLogedIn = true;
      req.session.user = user;
      await req.session.save();

      res.redirect('/');
    } catch (err) {
      console.log("Signup Error:", err.message);
      return res.status(422).render('store/signup', {
        title: "Sign-Up",
        isLogedIn: false,
        errorMessage: [err.message],
        oldInput: {
          firstName,
          lastName,
          email,
          password,
          userType
        },
        editing,
        user: {}
      });
    }
  }
];



// GET the edit profile form
exports.getEditPage = async (req, res) => {

    const editing = req.query.editing === 'true';
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');

        res.render('./store/signup', { 
            user,
            editing: editing, 
            title: "Edit Profile", 
            isLogedIn: req.isLogedIn, 
            oldInput: { 
                firstName: user.firstName, 
                lastName: user.lastName, 
                email: user.email 
            } 
        });
    } catch (err) {
        res.status(500).send('Error fetching user'); 
    }
};

// POST updated profile
exports.postEditPage = async (req, res) => {
  const { firstName, lastName, email, id } = req.body;
  const files = req.files;

  try {
    const user = await User.findById(id);
    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    // ✅ IMAGE update
    if (files?.profilePicture) {
      if (user.profilePicturePublicId) {
        await cloudinary.uploader.destroy(user.profilePicturePublicId).catch(err => {
          console.warn("Error deleting old image:", err.message);
        });
      }

      const imageBuffer = files.profilePicture[0].buffer;
      const imageResult = await fileUploadInCloudinary(imageBuffer);

      if (!imageResult?.secure_url) {
        throw new Error("Image upload failed");
      }

      user.profilePicture = imageResult.secure_url;
      user.profilePicturePublicId = imageResult.public_id;
    }

    // ✅ Update other fields
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;

    await user.save();

    res.redirect('/');
  } catch (err) {
  console.error('❌ Error updating user:', err);
  res.status(500).send('Error updating user: ' + err.message);
}
};

exports.getSignUpPage = (req, res, next) => {
    const editing = req.query.editing === 'true';
    const { firstName, lastName,email, password, userType } = req.body;

    res.render('./store/signup', {
        title: "Sign-UP Page",
        isLogedIn: req.isLogedIn,
        oldInput: {
            firstName,
            lastName,
            email,
            password,
            userType
        },
        editing
    });
};

exports.deleteUserPage = async (req, res) => {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send('User not found');
        const { email, password } = req.body;

        res.render('./store/delete', {
            title: "Delete Page",
            isLogedIn: req.isLogedIn,
            oldInput: { email, password },
            errorMessage: [],
            user: req.session.user,
        });
    } catch (err) {
        res.status(500).send('Error fetching user');
    }
};
exports.deleteUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched) {
      return res.status(401).render('./store/delete', {
        title: "Delete Page",
        isLogedIn: false,
        errorMessage: ['Incorrect password'],
        oldInput: { email },
        user: req.session.user
      });
    }

    // 🔁 Find all events organized by this user
    const userEvents = await vender.find({ organizer: user._id });

    // 🔁 Delete all event data related to this user
    for (const event of userEvents) {
      const cloudinaryDeletePromises = [];

      if (event.imagePublicId)
        cloudinaryDeletePromises.push(cloudinary.uploader.destroy(event.imagePublicId));
      if (event.bannerImagePublicId)
        cloudinaryDeletePromises.push(cloudinary.uploader.destroy(event.bannerImagePublicId));

      await Promise.all(cloudinaryDeletePromises);

      // Delete related event data
      await Orders.deleteMany({ event: event._id });

      // Delete the event itself
      await vender.findByIdAndDelete(event._id);
    }

    // 🔁 Clean from other users' booked arrays (if applicable)
    await User.updateMany(
      { booked: user._id },
      { $pull: { booked: user._id } }
    );

    // 🔁 Delete user’s bookings as attendee
    await Orders.deleteMany({ attendee: user._id });

    // 🔁 Delete user’s profile image if exists
    if (user.profilePicturePublicId) {
      await cloudinary.uploader.destroy(user.profilePicturePublicId).catch(err => {
        console.warn("Error deleting profile image:", err.message);
      });
    }

    // 🔁 Delete the user itself
    await User.findByIdAndDelete(user._id);

    // 🔁 End session if this user is logged in
    if (req.session.user && req.session.user._id.toString() === user._id.toString()) {
      req.session.destroy(() => {
        return res.redirect('/logIn');
      });
    } else {
      return res.redirect('/');
    }

  } catch (err) {
    console.error('❌ Delete Error:', err);
    res.status(500).send('Error deleting user');
  }
};
