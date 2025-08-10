const mongoose =  require('mongoose');
// const passport =require('passport');
const plm = require('passport-local-mongoose')


mongoose.connect('mongodb+srv://varunmalviya333:ZTb9RJTONRdGEnjW@cluster0.elknylu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

const userSchema = mongoose.Schema({
username : String,
name : String,
password: String,
profileImage : {
    type:String,
    default: 'default.jpg'
},
email : String,
Bio : String,
massages:{
    type:Array,
    default:[],
    ref:"msg"
},
followers:[{type: mongoose.Schema.Types.ObjectId, ref: "followers"}],
following:[{type: mongoose.Schema.Types.ObjectId, ref: "following"}],
posts:  [{type: mongoose.Schema.Types.ObjectId, ref: "post"}],
postsave:[{
    type: mongoose.Schema.Types.ObjectId,
    ref:"post"
}],
socketId: {
    type: String,
  },

});

userSchema.plugin(plm);

module.exports = mongoose.model('user', userSchema);
