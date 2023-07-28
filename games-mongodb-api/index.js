const API_PORT = 3000;
const mongoose = require('mongoose');
const Joi = require("joi");
const express = require("express");
const app = express();
app.use(express.json());
app.listen(API_PORT, () => console.log('Čekám na portu ' + API_PORT + '...'));

// Připojení k Mongo databázi
mongoose
    .connect('mongodb://127.0.0.1:27017/gamesdb', { useNewUrlParser: true })
    .then(() => console.log('Připojeno k MongoDB! :-)'))
    .catch(error => console.error('Připojení k MongoDB se nezdařilo! :-(', error));


// Mongose schéma her
const gameSchema = new mongoose.Schema({
    name: String,
    producer: String,
    platform: String,
    publisherID: mongoose.Schema.Types.ObjectId,
    developerID: mongoose.Schema.Types.ObjectId,
    genres: [ String ],
    pegi: Number,
    isAvailable: Boolean,
    dateAdded: {
        type: Date,
        default: Date.now
    }
});

// Mongose schéma firem
const companySchema = new mongoose.Schema({
    name: String,
    founded: Date,
    headquarters: String,
    perex: String,
    role: String    // "developer" nebo "publisher"
})

//
const Game = mongoose.model("Game", gameSchema);
const Company = mongoose.model("Company", companySchema);
const genres = ["Adventure", "Action", "RPG", "Fantasy", "Strategy", "Simulation", "Shooter", "Racing", "Sport"];
//

// GET metody
app.get("/api/games", (req, res) => {
    Game.find().then(games => { res.json(games) })
});
app.get("/api/games/:id", (req, res) => {
    const id = String(req.params.id);
    Game.findById(id, (err, result) => {
        if (err || !result) {
            res.status(404).send("Hra není v naší databázi.");
        }
        else
            res.json(result);
    });
});

// POST metoda
app.post('/api/games', (req, res) => {
    const { error } = validateGame(req.body);
    if (error) {
        res.status(400).send(error.details[0].message);
    } else {
        Game.create(req.body)
            .then(result => { res.json(result) })
            .catch(err => { res.send("Nepodařilo se uložit hru! :-(") });
    }
});

// validace vstupních dat
function validateGame(game, required = true) {
    const schema = Joi.object({
        name:           Joi.string().min(3),
        producer:       Joi.string(),
        platform:       Joi.string(),
        genres:         Joi.array().items(Joi.string()).min(1),
        isAvailable:    Joi.bool(),
        pegi:           Joi.number()
    });
    return schema.validate(game, { presence: (required) ? "required" : "optional"});
}

function validateCompany(company, required = true) {
    const schema = Joi.object({
        name:           Joi.string().min(3),
        founded:        Joi.date(),
        headquarters:   Joi.string().min(2),
        perex:          Joi.string().min(10),
        role:           Joi.string().valid("developer", "publisher")
    });
    return schema.validate(company,{ presence: (required) ? "required" : "optional" });
}


