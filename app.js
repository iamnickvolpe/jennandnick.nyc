require('dotenv').config();
var express = require('express');
var path = require('path');
const { google } = require('googleapis');
var GoogleSpreadsheet = require('google-spreadsheet');
var ejs = require("ejs");
const nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

var app = express();

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

var doc = new GoogleSpreadsheet(process.env.SPREADSHEET);

var creds = {
  "type": "service_account",
  "private_key": process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.GOOGLE_CLIENT_EMAIL,
}

app.get("/api/households/:id", function (req, res) {
  // Query Parameters: code
  var response = {};

  doc.useServiceAccountAuth(creds, function () {
    doc.getRows(process.env.SHEET_HOUSEHOLDS, { "query": "id = " + req.params.id }, function (err, households) {
      if (households[0] && req.query.code.toLowerCase() == households[0].code.toLowerCase()) {
        response.addressee = households[0].addressee;
        response.notes = households[0].notes;
        response.updated = households[0].updated;
        response.message = households[0].message;

        doc.getRows(process.env.SHEET_GUESTS, { "query": "household = " + req.params.id + " and list = A and adult = TRUE" }, function (err, guests) {
          response.guests = [];
          guests.map(function (guest) {
            response.guests.push({
              id: guest.id,
              name: guest.firstname,
              email: guest.email,
              attending: guest.attending,
              notes: guest.notes
            });
            response.guests.sort();
          });
          res.json(response);
        });
      } else {
        res.json({ error: 'Invalid credentials.' });
      }
    });
  });
});

app.post("/api/households/:id", function (req, res) {
  // Query Parameters: code
  doc.useServiceAccountAuth(creds, function () {
    doc.getRows(process.env.SHEET_HOUSEHOLDS, { "query": "id = " + req.params.id }, function (err, households) {
      if (households[0] && req.query.code.toLowerCase() == households[0].code.toLowerCase()) {

        var invalidEntries = [];

        req.body.guests.map(function (guest) {
          if (startsWithEquals(guest.attending) || !isTrueFalse(guest.attending)) {
            invalidEntries.push(guest.attending);
          }

          if (startsWithEquals(guest.email)) {
            invalidEntries.push(guest.email);
          }
        });

        if (startsWithEquals(req.body.notes)) {
          invalidEntries.push(req.body.notes)
        }

        if (!invalidEntries.length) {
          households[0].notes = req.body.notes;
          households[0].updated = new Date();
          households[0].save();

          var guestsHtml = "";
          req.body.guests.map(function (guest) {
            guestsHtml = guestsHtml + "<li>" + guest.name + ": " + returnStatus(guest.attending) + " | " + guest.email + "</li>";
            doc.getRows(process.env.SHEET_GUESTS, { "query": "id = " + guest.id }, function (err, guests) {
              guests[0].attending = guest.attending;
              guests[0].email = guest.email;
              guests[0].updated = new Date();
              guests[0].save();
            });
          });
          
          generateMail({
            from: 'nick@iamnickvolpe.com',
            to: ['nick@iamnickvolpe.com', 'jenn.sager@gmail.com'],
            subject: 'jennandnick.nyc RSVP: ' + req.body.addressee,
            html: "<ul>" + guestsHtml + "</ul>" + "<p>" + req.body.notes + "</p>"
          });

          req.body.guests.map(function(guest) {
            if (guest.attending === "TRUE" && guest.email) {
              generateMail({
                from: 'nick@iamnickvolpe.com',
                to: guest.email,
                subject: 'J+N Wedding RSVP Confirmation - Yaaaaaaay!',
                html: "<p>Hey " + guest.name + "!</p>" + "<p>We're so happy to have you at our wedding! As a friendly reminder, the ceremony and reception will be held at:</p><p><strong>The Dumbo Loft: 155 Water St. Brooklyn, NY 11201</strong><br>Saturday, October 27th at 5:00pm</p><p>If you have any questions or if anything changes, don't hesitate to reach out.</p><p>More information can be found on our website <a href='https://www.jennandnick.nyc'>www.jennandnick.nyc</a>.</p><p>&#60;3 Jenn & Nick</p>"
              });
            }
          });

          res.send({ success: "Updated successfully." });
        } else {
          res.json({ error: 'Invalid entries.' });
        }


      } else {
        res.json({ error: 'Invalid credentials.' });
      }
    });
  });
});

function generateMail(options) {
  var mailOptions = {
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html
  };
  transporter.sendMail(mailOptions);
}

function returnStatus(attending) {
  if (attending === "TRUE") {
    return "Accepted"
  } else {
    return "Declined"
  }
}

function startsWithEquals(string) {
  if (string.startsWith('=')) {
    return true;
  } else {
    return false;
  }
}

function isTrueFalse(string) {
  if (string === "TRUE" || string === "FALSE") {
    return true;
  } else {
    return false;
  }
}

app.get('*', function (req, res) {
  res.sendFile('/public/index.html', { root: __dirname });
});

module.exports = app;
