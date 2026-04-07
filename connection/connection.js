const mongoose=require('mongoose')

const connect=mongoose.connect('mongodb://127.0.0.1/debt')

module.exports=connect;