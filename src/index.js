'use strict';

var Alexa = require('alexa-sdk');
var http = require('http');
var APP_ID = "amzn1.ask.skill.cbdf9abe-1841-4f70-974d-3008a8174d1b";
var alexa;

exports.handler = function(event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var WELCOME_MESSAGE = "Welcome to Rutgers Buses! You can ask a question like, when is the next LX at the College Ave Student Center?";
var REPROMPT_MESSAGE = "For instructions on what can you say, please say help me.";
var HELP_MESSAGE = "You can ask questions like, when is the next LX at the College Ave Student Center? ... So, what can I help you with?";
var STOP_MESSAGE = "Goodbye!";

var routes = {
    "lx":"lx",
    "a":"a",
    "b":"b",
    "c":"c",
    "double e":"ee",
    "f":"f",
    "h":"h",
    "rex l":"rexl",
    "rex b":"rexb",
    "weekend 1":"wknd1",
    "weekend 2":"wknd2",
    "summer 1":"wknd1",
    "summer 2":"wknd2"
};

        
function get_json(url, callback) {
    http.get(url, function(res) {
        if(res.statusCode != 200) this.emit(':ask',"There was an error in accessing bus route information. Try asking again.", HELP_MESSAGE);
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        
        res.on('end', function() {
            var response = JSON.parse(body);
            callback(response);
        });
    });
};

function slotValue(slot, useId, isStop){
    let value = slot.value;
    let resolution = (slot.resolutions && slot.resolutions.resolutionsPerAuthority && slot.resolutions.resolutionsPerAuthority.length > 0) ? slot.resolutions.resolutionsPerAuthority[0] : null;
    if(resolution && resolution.status.code == 'ER_SUCCESS_MATCH'){
        let resolutionValue = resolution.values[0].value;
        value = resolutionValue.id && useId ? resolutionValue.id : resolutionValue.name;
    }
    if(isStop && resolution == null) return null;
    else return value;
};

var handlers = {

    'LaunchRequest': function(){
        this.emit(":ask", WELCOME_MESSAGE, REPROMPT_MESSAGE);
    },
    'RutBus': function(){
        var bus;
        var stop;
        var stopID;
        var predictionMessage;
        var cardContent = "";
        var prediction;
        if(this.event.request.intent.slots.Bus && this.event.request.intent.slots.Bus.value) bus = slotValue(this.event.request.intent.slots.Bus).toLowerCase();
        if(!routes[bus]){
            this.emit(":ask", "That doesn't seem to be a valid bus route. You can say help me for instructions.", HELP_MESSAGE);
        }
        if(this.event.request.intent.slots.Stop && this.event.request.intent.slots.Stop.value){
            stop = slotValue(this.event.request.intent.slots.Stop, false, true);
        }
        if(stop == null){
            this.emit(":ask", "That doesn't seem to be a valid stop. You can say help me for instructions.", HELP_MESSAGE);           
        }
                        
        var url = "http://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a=rutgers&r=" + routes[bus];
        var obj;
        
        get_json(url, function (resp) {
            obj = resp;
            obj = obj.route;
            for(var x = 0; x < obj.stop.length; x++)
            {
                if(obj.stop[x].title.toLowerCase() == stop.toLowerCase())
                {
                    stopID = obj.stop[x].stopId;
                    break;
                }
            }
            
            if(!stopID){
                alexa.emit(":tell", stop + " is not on the route for the " + bus + ".");
            }
            
            var url = "http://webservices.nextbus.com/service/publicJSONFeed?command=predictions&a=rutgers&stopId=" + stopID + "&routeTag=" + routes[bus];
            var time;
            get_json(url, function(resp){
               obj = resp;
               obj = obj.predictions.direction;
                if(obj)
                {
                    cardContent += bus + " at " + stop + " in:\n";
                    for(var x = 0; x < obj.prediction.length; x++)
                    {
                        if(obj.prediction[x].minutes > 0){
                            prediction = obj.prediction[x].minutes == 1 ? obj.prediction[x].minutes + " minute":obj.prediction[x].minutes + " minutes";
                            if(x == 0) time = prediction;
                        }
                        else{ 
                            prediction = obj.prediction[x].seconds + " seconds";
                            if(x == 0) time = prediction;
                        }
                        cardContent += prediction + "\n";
                    }
                    predictionMessage = "The next " + bus + " will be at " + stop + " in " + time + ". View the card in your Alexa app for more predictions.";
                    alexa.emit(":tellWithCard", predictionMessage, "Bus Prediction", cardContent, null);
                }
                else{
                    predictionMessage = "There are currently no predictions available for that route and stop combination.";
                    alexa.emit(":tell",predictionMessage);
                } 
            });
        });
    },
    /*'RouteInfo': function(){
        var bus;
        var obj;
        
        if(this.event.request.intent.slots.Bus && this.event.request.intent.slots.Bus.value) bus = (slotValue(this.event.request.intent.slots.Bus)).toLowerCase();
        else{
            this.emit(":tell", "That doesn't seem to be a valid bus route. You can say help me for instructions.");
        }
        var url = "http://webservices.nextbus.com/service/publicJSONFeed?command=routeConfig&a=rutgers&r=" + routes[bus];
        var message = "The route for the " + bus + " is as follows: ";
        var cardMessage = "Stops for " + bus + ":\n";

        get_json(url, function(resp){
            obj = resp.route;
            for(var x = 0; x < obj.stop.length; x++){
                if(x != obj.stop.length-1) message += obj.stop[x].title + ", ";
                else message += obj.stop[x].title + ".";
                cardMessage += obj.stop[x].title + "\n";
            }
            
            alexa.emit(":tellWithCard", message, "Route Info", cardMessage, null);
        });
        
    },*/
    'AMAZON.HelpIntent': function(){
        this.emit(":ask", HELP_MESSAGE, HELP_MESSAGE);
    },
    'AMAZON.RepeatIntent': function(){
        this.emit(":ask", WELCOME_MESSAGE, REPROMPT_MESSAGE);
    },
    'AMAZON.StopIntent': function(){
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function(){
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest': function(){
        this.emit(':tell', STOP_MESSAGE);
    },
    'Unhandled': function(){
        this.emit(":ask", "Sorry, I didn't get that. Try asking a question like, when is the next H at the Stadium?", HELP_MESSAGE);
    },
};