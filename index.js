var express = require('express');
var cors = require('cors');
var app = express();
const http = require('http').Server(app);
const tourModel = require("./model");
const Tour = require("./tour");
const puzzleHistory = require("./PuzzleHistory");
const mongoose = require("mongoose");
const tournament = require("./tournament");
var Filter = require('bad-words');
filter = new Filter();
mongoose.connect('mongodb+srv://atharvaDB:atharva@cluster0.pxyli6m.mongodb.net/?retryWrites=true&w=majority',
  {
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function () {
  console.log("Connected successfully");
});

//update your host here
var whitelist =''

const io = require('socket.io')(http,{
  cors: {
    origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(null, true)
    }
  },
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;
app.use(cors())
http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});

	
// Chatroom
var clients = [];
io.on('connection', (socket) => {
 //chatmessage
 socket.on('chat message', async data => {
 
  var msg=JSON.parse(data); 
 if (filter.isProfane(msg.message)) {
   io.to(msg.tourid).emit('mod message', msg.username +'!,Please be respectful in the chat else you will be banned....')
  } else {
  io.to(msg.tourid).emit('chat message', data);
  const tour=await getTour(msg.tourid);
  tour.addMsg({"username":msg.username,"message":msg.message});
  }
});

 //get tour
   socket.on('get tour', async data => {
     var data=JSON.parse(data); 
   const tour=await getTour(data.tourid);
 var player=tour.players.find(plyr=>plyr.username===data.username);
   if(!player){
   const user=await getUser(data.username);
   player=user.toJson();
   }
   socket.username = data.username;
   socket.room=data.tourid;
   socket.join(tour.tourid);
   clients.push(socket);
   if(tour.isStarted())
    tour.setsortBy("total");
console.log(tour.toJson());	   
    io.to(tour.tourid).emit('live users',  touruserList(clients,data.tourid));  
  socket.emit("init-user",JSON.stringify({"tour": tour.toJson(),"player":player}));
});
	
//get tour
   socket.on('gettour-nouser', async data => {
     var data=JSON.parse(data); 
   const tour=await getTour(data.tourid);
   if(tour.isStarted())
    tour.setsortBy("total");
  console.log(tour.toJson());	   
    io.to(tour.tourid).emit('live users',  touruserList(clients,data.tourid));  
  socket.emit("init-tour",JSON.stringify({"tour": tour.toJson()}));
});	
	
 socket.on('update tour', async data => {
     var data=JSON.parse(data); 
   const tour=await getTour(data.tourid);
  for(var i=0; i<tour.players.length;i++){ 
   var player=tour.players[i];
  player=await getUser(player);
  tour.updPlayer(player.toJson());
  }
});	

 //get tour
 socket.on('get game', async data => {
  var data=JSON.parse(data); 
 const tour=await getTour(data.tourid);
 console.log(tour.isStarted());	 
 if(tour.isStarted() &&!tour.isEnded()){	 
 var userfound=tour.players.some(plyr=>plyr.username===data.username);
 tour.isJoined(userfound);
  var player=tour.players.find(plyr=>plyr.username===data.username);
 if(player && player.attempted===false){	 
 socket.emit("init-game",JSON.stringify(tour.toJson()));
 }
 }

});
	
//get tour
 socket.on('get game-multi', async data => {
  var data=JSON.parse(data); 
 const tour=await getTour(data.tourid);
 console.log(tour.isStarted());	 
 if(tour.isStarted() &&!tour.isEnded()){	 
 var userfound=tour.players.some(plyr=>plyr.username===data.username);
 tour.isJoined(userfound);
  var player=tour.players.find(plyr=>plyr.username===data.username);
 if(player){	 
 socket.emit("init-game",JSON.stringify(tour.toJson()));
 }
 }

});	

socket.on('add player', async data => {
  var data=JSON.parse(data); 
  const tour=await getTour(data.tourid);
  const player=await getUser({"username":data.username});
  var userfound=tour.players.some(plyr=>plyr.username===player.username);
  player.setJoined(true);
  if(!userfound){
  tour.addPlayer(player.toJson());
  if(tour.isStarted())
  tour.setsortBy("total");
  io.to(tour.tourid).emit("update players",JSON.stringify(tour.toJson()));	
   }
 	socket.join(tour.gameid);
  io.to(tour.tourid).emit("player added",JSON.stringify(player.toJson())); 
 
 });

	

 socket.on('remove player', async data => {
    var data=JSON.parse(data); 
    const tour=await getTour(data.tourid);	
    if(!tour.isStarted()){	
        var newTour= new tournament.Tournament({"id":data.tourid});
        const player=await getUser({"username":data.username});
        newTour.remPlayer(player.toJson());
        socket.leave(newTour.gameid);
        io.to(newTour.tourid).emit("player left",JSON.stringify(player.toJson())); 
        tour=await getTour(data.tourid);
        if(tour.isStarted())
        tour.setsortBy("total");
        io.to(tour.tourid).emit("update players",JSON.stringify(tour.toJson()));  
	 
    }	 
});


socket.on('update player', async data => {
  var data=JSON.parse(data); 
  console.log(data)
   const tour=await getTour(data.tourid);
   var player=tour.players.find(plyr=>plyr.username===data.username);
 if(player){
  player=await getUser(player);
  player.setScore(data.score);
  player.setJoined(true);
  tour.updPlayer(player.toJson());
  tour.setsortBy("total");
  io.to(tour.tourid).emit("update players",JSON.stringify(tour.toJson()));  
 } else {
 socket.emit("info","Duplicate score submission. Not allowed");  	 
 }
});
socket.on('update round', async data => {
  var data=JSON.parse(data); 
  console.log(data)
   const tour=await getTour(data.tourid);
   var player=tour.players.find(plyr=>plyr.username===data.username);
 if(player){
  player=await getUser(player);
  player.setAttempted(true);
  player.setJoined(true);
  player.setScore(data.score);
  tour.updPlayer(player.toJson());
  tour.setsortBy("total");
  io.to(tour.tourid).emit("update scores",JSON.stringify(tour.toJson()));  
 } else {
 socket.emit("info","Duplicate score submission. Not allowed");  	 
 }
});
	
socket.on('puzzle history', async data => {
  var data=JSON.parse(data); 
  await updatePuzzleHistory(data);
});	

socket.on('create-tour', async data => {
  var data=JSON.parse(data); 
   console.log(data);
  var tour1=new Tour.TournamentModel(data);
  await createTour(tour1);
  var toururl="https://www.learnmyskills.com/"+ tour1.format +"/"+ tour1.id;
 console.log(toururl);	
 socket.emit("create-tour",JSON.stringify({url:toururl,"tour":tour1}));	
});
	
socket.on('update-tour', async data => {
  var data=JSON.parse(data); 
   console.log(data);
    tourModel.findOneAndUpdate({ id: data.id },data.tour,{upsert: true},  function(err, doc) {
      if (err) console.log(err);    
    });
  var toururl="https://www.learnmyskills.com/"+ data.tour.format +"/"+ data.id;
 console.log(toururl);	
 socket.emit("create-tour",JSON.stringify({url:toururl}));	
});
	
	
	
  var createuserList = function(clients) {
	  var liveusers =[];
   clients.forEach(function(client) {
	 if(!userExists(liveusers,client.username))
            liveusers.push(client.username);
          });
	  return liveusers;
   };
  var touruserList = function(clients,tourid) {
	  var liveusers =[];
   clients.forEach(function(client) {
	 if(!userExists(liveusers,client.username) && client.room===tourid)
            liveusers.push(client.username);
          });
	  return liveusers;
   };
	
socket.on('keep-live', async data => {
var data=JSON.parse(data); 
socket.username = data.username;
socket.room=data.tourid;
socket.join(data.tourid);
clients.push(socket);
io.to(data.tourid).emit('live users',  touruserList(clients,data.tourid));  
});	
	
socket.on('disconnect', function() {
console.log('Got disconnect!');
var client=  removeItemFromArray(clients,socket);
});
});

function removeItemFromArray(array, n) {
  const index = array.indexOf(n);

  // if the element is in the array, remove it
  if(index > -1) {
   console.log(index);
      // remove item
      array.splice(index, 1);
  }
  return array;
}

function removeItemFromObjectArray(array, filter) {
  let index = array.findIndex(i => i.username === filter.username);

    // if the element is in the array, remove it
    if(index > -1) {

        // remove item
      return  array.splice(index, 1);
    }
    return null;
}
  
  function userExists(array, n) {
    const index = array.indexOf(n);

    // if the element is in the array, remove it
    if(index > -1) {

       return true 
    }
    return false;
}

async function getTour(tourid) {
  try {
     const tourdb= await tourModel.findOne({id:tourid});
     return new tournament.Tournament(JSON.parse(JSON.stringify(tourdb)));
     } finally {
   console.log("tour loaded ");
  }
}


async function getUser(user) {
 try {
  // const user= await userModel.findOne({id:userid});
  var player=new tournament.Player(JSON.stringify(user));
  return player;
  } finally {
    console.log("loaded");
  }
} 

async function updatePuzzleHistory(puzzleHistry){
  try {
	  const pz = new puzzleHistory(puzzleHistry);
   const result = await pz.save();
   console.log(result);
     } finally {
    console.log("updated");
    }
}	 
	
async function createTour(tour){
  try {
    const tr = new tourModel(tour);
   const result = await tr.save();
   console.log(result);
     } finally {
    console.log("Tournament created");
    }
}

