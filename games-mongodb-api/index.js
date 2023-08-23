const API_PORT = 5000;
const mongoose = require('mongoose');
const Joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const expressSession = require("express-session");
const app = express();
app.use(express.json());
app.use(expressSession({    // registrace middleware
    secret: "b%$#kw33$",
    resave: false,              // nebude tvořit cookie při každé odpovědi
    saveUninitialized: false,   
    cookie: {
        secure: process.env.NODE_ENV === "production",  // prohlížeč bude posílat cookie na server jen při bezpečném https spojení
        httpOnly: true  // nebude přístupná pro JS v prohlížeči
    }
}));
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

// Mongose schéma uživatelů
const userSchema = new mongoose.Schema({
    email: {type: String, index: {unique: true}},
    passwordHash: String,
    isAdmin: Boolean
});

//
const Game = mongoose.model("Game", gameSchema);
const Company = mongoose.model("Company", companySchema);
const User = mongoose.model("User", userSchema);
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

// GET - zobrazení informací o uživateli
app.get("/api/auth", (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.status(401).send("Nejprve se přihlaste");
        return;
    }
    res.send(getPublicSessionData(user));
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

// POST request uživatele
app.post("/api/user", (req, res) => {
    const userData = req.body;
    const {error} = validateUser(userData);
    if (error) {
        res.status(400).send(error.details[0].message);
        return;
    }
    const userCreateData = {
        email: userData.email,
        passwordHash: hashPassword(userData.password),
        isAdmin: false
    };

    User.create(userCreateData)
        .then(savedUser => {
            const result = savedUser.toObject();
            delete result.passwordHash;
            res.send(result);
        })
        .catch(e => {
            if (e.code === 11000) {
                res.status(400).send("Účet se zadaným emailem již existuje");
                return;
            }
            res.status(500).send("Nastala chyba při registraci");
        });
});

// POST metoda přihlášení uživatele
app.post("/api/auth", (req, res) => {
    const loginData = req.body;
    const {error} = validateLogin(req.body);
    if (error) {
        res.status(400).send(error.details[0].message);
        return;
    }
    User.findOne({email: loginData.email})
        .then(user => {
            if (!user || !verifyPassword(user.passwordHash, loginData.password)) {
                res.status(400).send("Email nebo heslo nenalezeno!");
                return;
            }
            const sessionUser = user.toObject();
            delete sessionUser.passwordHash;
            req.session.user = sessionUser;
            req.session.save((err) => {
                if (err) {
                    res.status(500).send("Nastala chyba při přihlašování");
                    return;
                }
                res.send(getPublicSessionData(sessionUser));
            });
        })
        .catch(() => res.status(500).send("Nastala chyba při hledání uživatele"));
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

// DELETE request - odhlášení uživatele
app.delete("/api/auth", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).send("Nastala chyba při mazání session");
            return;
        }
    res.send("Uživatel odhlášen");
    });
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

function validateUser(data) {
    const schema = Joi.object({
        email: Joi.string().email(),
        password: Joi.string().min(4)
    });
    return schema.validate(data, {presence: "required"});
}

function validateLogin(data) {
    const schema = Joi.object({
        email: Joi.string(),
        password: Joi.string()
    });
    return schema.validate(data, {presence: "required"});
}

// Hashovací funkce
function hashPassword(password, saltRounds = 10) {
    return bcrypt.hashSync(password, saltRounds);
}

function verifyPassword(passwordHash, password) {   // funkce bere jako parametry 2 otisky
    return bcrypt.compareSync(password, passwordHash);  // tyto otisky porovná pomocí metody compareSync()
}

// Session funkce 
// - bude vracet selektované údaje uživateli po přihlášení
// - vrátí nový objekt vytvořený podle objektu sessionData
function getPublicSessionData(sessionData) {
    const allowedKeys = ["_id", "email", "isAdmin"];
    const entries = allowedKeys
        .map(key => [key, sessionData[key]]);
    return Object.fromEntries(entries);
}
