//Node modules & setup
const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const bodyParser = require('body-parser');
const request = require('request');

//HERE credentials
const hereID = 'uHmohQEsYnwhA4FGz1Jw';
const hereCode = 'hKz7JnGqtqj5UECMSBqDHw'; 

//Twilio credentials:
const accountSid = 'TWILIO-SID';
const authToken = 'TWILIO-TOKEN';
const client = require('twilio')(accountSid, authToken);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
   extended: true
}));


var places = [];

app.post('/sms', (req, res) => {
   const twiml = new MessagingResponse();
   var incoming = req.body.Body;
   if (incoming.length > 1) {
      if (!incoming.includes('near')) { //Making sure it is in correct format
         twiml.message('Please send a message with a place name and address. Example: "Mexican food near 701 Pike Street Seattle"');
         res.writeHead(200, {
            'Content-Type': 'text/xml'
         });
         res.end(twiml.toString());
         return;
      }
      places = [] //clear places in case user gives two requests in a row without diving into additional info
      var searchQuery = incoming.split(' near ')[0];
       //Extract the search query
      var locationString = incoming.split(' near ')[1]; //Extract the location
      var geocodeURL = 'https://geocoder.cit.api.here.com/6.2/geocode.json' +
         '?app_id=' + hereID +
         '&app_code=' + hereCode +
         '&searchtext=' + locationString;
      console.log(geocodeURL);

      request.get(geocodeURL, (error, response, body) => {
         if (error) {
            return console.log(error);
         }
         let json = JSON.parse(body);
         if (json.Response.View[0] == null ||
         json.Response.View[0] == null) {
            //Can't find placeResults
            twiml.message('No search results found for "' + searchQuery +'" in the area. Please try again.');
            res.writeHead(200, {
               'Content-Type': 'text/xml'
            });
            res.end(twiml.toString());
            return;
         }

         var coordinates = {
            lat: json.Response.View[0].Result[0].Location.DisplayPosition.Latitude,
            long: json.Response.View[0].Result[0].Location.DisplayPosition.Longitude
         };

         var placesURL = 'https://places.cit.api.here.com/places/v1/autosuggest' +
            '?at=' + coordinates.lat + ',' + coordinates.long +
            '&q=' + searchQuery.replace(/ /g, '+') +
            '&app_id=' + hereID +
            '&tf=plain' +
            '&app_code=' + hereCode;

         console.log(placesURL);

         request.get(placesURL, (error, response, body) => {
            if (error) {
               return console.log(error);
            }
            let json = JSON.parse(body);
            var placeResults = json.results;
            var resultAmount = Math.min(3, placeResults.length)

            var responseMessage = 'Here are the ' + resultAmount + ' closest ' + searchQuery +
               ' places to you: \n';

            for (i = 0; i < resultAmount; i++) {
               if (placeResults[i].resultType != 'category') {
                  places.push({
                     name: placeResults[i].title,
                     category: placeResults[i].category,
                     address: placeResults[i].vicinity
                  });
                  responseMessage += '(' + places.length + ') ' + placeResults[i].title + '\n';
               } else {
                  resultAmount++; //means that resultType was a category
               }
            }
            twiml.message(responseMessage + '\nReply with # to learn more information');
            res.writeHead(200, {
               'Content-Type': 'text/xml'
            });
            res.end(twiml.toString());
         });
      });
   } else if (places.length > 0 && incoming.length == 1) { //reply
      twiml.message(places[parseInt(incoming) - 1].name + ' is located at ' + places[parseInt(incoming) - 1].address);
      res.writeHead(200, {
         'Content-Type': 'text/xml'
      });
      res.end(twiml.toString());
      places = []; //Empty places to restart
   }
});

http.createServer(app).listen(1337, () => {
   console.log('Express server listening on port 1337');
});
