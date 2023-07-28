const API_PORT = 5000;
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
    platform: [ String ],
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
    founded: Number,
    headquarters: String,
    perex: String,
    role: String    // "developer" nebo "publisher"
})

//
const Game = mongoose.model("Game", gameSchema);
const Company = mongoose.model("Company", companySchema);
const genres = ["Adventure", "Action", "RPG", "Fantasy", "Strategy", "Simulation", "Shooter", "Racing", "Sport"];
const platform = ["PlayStation 5", "PlayStation 4", "Xbox Series", "Xbox One", "PC", "Nintendo"]
//

// GET metody
// vrátí všechny hry v databázi
app.get('/api/games', (req, res) => {
    const { error } = validateGet(req.query);
    if (error)
    {
        res.status(404).send(error.details[0].message);
        return;
    }
    let dbQuery = Game.find();
    if (req.query.publisherID)
        dbQuery = dbQuery.where("publisherID", req.query.publisherID);
    if (req.query.developerID)
        dbQuery = dbQuery.where("developerID", req.query.developerID);
    if (req.query.genre)
        dbQuery = dbQuery.where("genres", req.query.genre);
    if (req.query.platform)
        dbQuery = dbQuery.where("platform", req.query.platform);
    if (req.query.limit)
        dbQuery = dbQuery.limit(parseInt(req.query.limit));

    dbQuery
        .then(games => { res.json(games) })
        .catch(err => { res.status(400).send("Požadavek na videohry selhal!"); });
});

// asyncrhonní metoda pro získání hry z databáze podle vývojářské nebo distributorské firmy
async function getGameByID(id) {
    let game = await Game.findById(id);
    if (game) {
        game = game.toJSON();
        let publisher = await Company.findById(game.publisherID).select("_id name");
        let developer = await Company.findById(game.developerID).select("_id name");
        game.publisherID = publisher.toJSON();
        game.developerID = developer.toJSON();
    }
    return game;
}
app.get("/api/games/:id", (req, res) => {
    getGameByID(req.params.id)
        .then(game => {
            if (game)
                res.send(game);
            else
                res.status(404).send("Videohra s daným ID nebyla nalezena!");
        })
        .catch(err => { res.status(400).send("Chyba požadavku GET na hru!") });
});

app.get('/api/developers', (req, res) => {
    const { error } = validateGet(req.query);
    if (error){
        res.status(400).send(error.details[0].message);
        return;
    }
    let dbQuery = Company.find().where("role", "developer");
    if (req.query.limit)
        dbQuery = dbQuery.limit(parseInt(req.query.limit));
    dbQuery
        .then(developers => { res.json(developers); })
        .catch(err => { res.status(400).send("Chyba požadavku na vývojáře!"); });
});

app.get('/api/publishers', (req, res) => {
    const { error } = validateGet(req.query);
    if (error) {
        res.status(400).send(error.details[0].message);
        return;
    }
    let dbQuery = Company.find().where("role", "publisher");
    if (req.query.limit)
        dbQuery = dbQuery.limit(parseInt(req.query.limit));
    dbQuery
        .then(publishers => { res.json(publishers); })
        .catch(err => { res.status(400).send("Chyba požadavku na distributory!"); });
});

app.get('/api/companies/:id', (req, res) => {
    Company.findById(req.params.id, (err, company) => {
        if (err)
            res.status(400).send("Firma s daným ID nebyla nalezena!");
        else
            res.json(company);
    });
});

app.get('/api/genres', (req, res) => {
    res.json(genres);
});

// PUT metody
app.put('/api/games/:id', (req, res) => {
    const { error } = validateGame(req.body, false);
    if (error) {
        res.status(400).send(error.details[0].message);
    } else {
        Game.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(result => { res.json(result) })
            .catch(err => { res.send("Nepodařilo se uložit hru!") });
    }
});

app.put('/api/companies/:id', (req, res) => {
    const { error } = validateCompany(req.body, false);
    if (error) {
        res.status(400).send(error.details[0].message);
    } else {
        Company.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(result => { res.json(result) })
            .catch(err => { res.send("Nepodařilo se uložit firmu") });
    }
});


// POST metoda hry
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

// POST metoda firmy
app.post('/api/company', (req, res) => {
    const { error } = validateCompany(req.body);
    if (error) {
        res.status(400).send(error.details[0].message);
    } else {
        Company.create(req.body)
            .then(result => { res.json(result) })
            .catch(err => { res.send("Nepodařilo se uložit firmu! :-(") });
    }
});

// DELETE metody
app.delete('/api/games/:id', (req, res) => {
    Game.findByIdAndDelete(req.params.id)
        .then(result => {
            if (result)
                res.json(result);
            else
                res.status(404).send("Hra s daným ID nebyla nalezena v databázi!");
        })
        .catch(err => { res.send("Chyba při mazání hry!") });
})

app.delete('/api/company/:id', (req, res) => {
    Game.find({ $or: [{ publisherID: req.params.id }, { developerID: req.params.id }] }).countDocuments()
        .then(count => {
            if (count != 0)
                res.status(400).send("Nelze smazat firmu, která je přiřazena k alespoň jedné videohře!")
            else
            {
                Company.findByIdAndDelete(req.params.id)
                    .then(result => { res.json(result) })
                    .catch(err => { res.send("Nepodařilo se smazat firmu!") });
            }
        }).catch(err => { res.status(400).send("Nepodařilo se smazat firmu!") });
});

// validace vstupních dat
function validateGame(game, required = true) {
    const schema = Joi.object({
        name:           Joi.string().min(3),
        platform:       Joi.array().items(Joi.string().valid(...platform)).min(1),
        publisherID:    Joi.string(),
        developerID:    Joi.string(),
        genres:         Joi.array().items(Joi.string().valid(...genres)).min(1),
        isAvailable:    Joi.bool(),
        pegi:           Joi.number()
    });
    return schema.validate(game, { presence: (required) ? "required" : "optional"});
}

function validateCompany(company, required = true) {
    const schema = Joi.object({
        name:           Joi.string().min(3),
        founded:        Joi.number(),
        headquarters:   Joi.string().min(2),
        perex:          Joi.string().min(10),
        role:           Joi.string().valid("developer", "publisher")
    });
    return schema.validate(company,{ presence: (required) ? "required" : "optional" });
}

function validateGet(getData) {
    const schema = Joi.object({
        limit:          Joi.number().min(1),
        platform:       Joi.string().valid(...platform),
        genre:          Joi.string().valid(...genres),
        publisherID:    Joi.string().min(3),
        developerID:    Joi.string().min(3)
    })
    return schema.validate(getData, { presence: "optional" });
}

// async function saveCompany() {
//     const newCompany = new Company({
//         name: "Ubisoft",
//         founded: 1986,
//         headquarters: "Saint-Mandé, France",
//         perex: "Ubisoft Entertainment SA (dříve Ubi Soft Entertainment SA či zkráceně Ubi Soft) je francouzský videoherní vývojář a vydavatel. Hlavní sídlo společnosti je v Montreuil ve Francii. Společnost má pobočky ve více než dvaceti zemích.",
//         role: "publisher"
//     });
//     const result = await newCompany.save();
//     console.log(result.id);
// }




// async function saveGame() {
//     const newGame = new Game({
//         name: "ASSASSIN'S CREED ODYSSEY",
//
//     })
// }