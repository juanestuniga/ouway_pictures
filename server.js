const express = require("express");
const app = express();
const { google } = require("googleapis");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 6000000 } // 6MB
});
const dotenv = require("dotenv").config();
const { Storage } = require('@google-cloud/storage');

const sheets = google.sheets({ version: "v4" });
const storageApi = google.storage({ version: "v1" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


app.post("/upload", upload.single("picture"), (req, res) => {
    const client = new google.auth.JWT(
      process.env.CLIENT_EMAIL,
      null,
      process.env.PRIVATE_KEY,
      ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/devstorage.read_write"]
    );
    client.authorize((err, tokens) => {
      if (err) {
        console.log(err);
        res.status(500).send({error: "Error while trying to authorize the client"});
        return;
      } else {
        console.log("Connected!");
        uploadToCloudStorage(client);
      }
    });
  
    function uploadToCloudStorage(auth) {
      if (!req.file) {
        res.status(400).send({ error: "No file was provided" });
        return;
      }
      const file = req.file;
      const orderNumber = req.body.orderNumber;
      if (!orderNumber) {
        res.status(400).send({ error: "No order number was provided" });
        return;
      }
  
      //Upload the file to Google Cloud Storage
      const bucketName = process.env.BUCKET;
      const fileName = `${file.originalname}`;
      const fileUpload = storageApi.objects.insert({
          auth: auth,
          bucket: bucketName,
          name: fileName,
          media: {
              body: file.buffer
          }
      }, (err, response) => {
          if (err) {
              console.log(err);
              res.status(500).send({ error: "Error while trying to upload the file" });
          } else {
              console.log(`File uploaded to: ${response.data.mediaLink}`);
              appendData(auth, new Date(), file.originalname, orderNumber, response.data.mediaLink);
          }
      });
    }
  //Upload the file to Google sheets
    function appendData(auth, date, fileName, orderNumber,imageUrl) {
        console.log(date);
        console.log(fileName);
        console.log(orderNumber);
        console.log(imageUrl);
      sheets.spreadsheets.values.append(
        {
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: "Sheet1",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: [[date, fileName, orderNumber,imageUrl]],
          },
          auth: auth,


      },
      (err, response) => {
        if (err) {
          console.log(err);
          res.status(500).send({ error: "Error while trying to append data" });
        } else {
          console.log(`Data append: ${response.data}`);
          res.send({ status: "success" });
        }
      }
    );
  }
});
app.get("/", (req, res) => {
    res.send("Welcome to the upload server")
});
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port 3000");
});

