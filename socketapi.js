const io = require( "socket.io" )();
const socketapi = {
    io: io
};

// Add your socket.io logic here!
io.on( "connection", function( socket ) {
    console.log( "A user connected" );
    socket.on("cmnt", msg =>{
        console.log(msg)
        io.emit("cmnt", "hlo from server") //io.emit server se msg frontend pr bhejne ke liye use krte hai
    })

});
// end of socket.io logic

module.exports = socketapi;