const mongoose =  require('mongoose');

const postSchema = mongoose.Schema({
    media:String,
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    caption:String,
    date:{
        type:Date,
        default:Date.now
    },
    likes:[{
    type: mongoose.Schema.Types.ObjectId,
    ref:"user"
    }],
    Comment: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:"comment"
    }]
    
    

});


module.exports = mongoose.model('post', postSchema);
