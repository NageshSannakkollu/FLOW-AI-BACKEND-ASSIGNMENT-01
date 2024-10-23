const express = require("express");
const app = express()
const cors = require("cors")
const bcrypt = require("bcrypt");
const path  = require("path");
const {open} = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const { error } = require("console");
app.use(cors())
app.use(express.json())

const dbPath = path.join(__dirname,"flowai.db");

let database = null;
const port = 3004;

const initializeDatabaseServer = async() => {
    try{
        database = await open({
        filename:dbPath,
        driver:sqlite3.Database
    })
    app.listen(port,() => {
        console.log(`Server Running At:http://localhost:${port}`)
    })
    }catch(e){
        console.log(`DB Error: ${e.message}`)
        process.exit(1);
    }
    
}

initializeDatabaseServer();

app.post("/users",async(request,response) => {
    const {username,password,phoneNumber,address} = request.body;
    const hashedPassword = await bcrypt.hash(password,10)
    const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
    const userDbResponse = await database.get(selectUserQuery);
    // console.log(userDbResponse);
    if(userDbResponse === undefined){
        const userInsertQuery = `
        INSERT 
        INTO 
        user(username,password,phoneNumber,address) 
        VALUES
        (
            '${username}',
            '${hashedPassword}',
            ${phoneNumber},
            '${address}'
        );`;

        const dbInsertResponse = await database.run(userInsertQuery);
        const newUserId = dbInsertResponse.lastID;
        response.send(`User created at: ${newUserId}`)
    }else{
        response.status(400);
        response.send("User already exists");
    }
})


//LoginUser 

app.post("/login",async(request,response) => {
    const {username,password} = request.body;
    // console.log(name,password);
    const checkLoginUser = `SELECT * FROM  user WHERE username='${username}';`;
    const responseLoginUser = await database.get(checkLoginUser);
    // console.log(responseLoginUser);
    if(responseLoginUser === undefined){
        response.status(400);
        response.send("Invalid User");
    }else{
        const isPasswordMatched = await bcrypt.compare(password,responseLoginUser.password)
        console.log(isPasswordMatched);
        if(isPasswordMatched === true){
            const payload = {
                username:username 
            }
            const jwtToken = jwt.sign(payload,'My_secret-token');
            response.send({jwtToken});
        }else{
            response.status(400)
            response.send("Invalid Password")
        }
    }
})

//middleware 

const authorizationMiddleWear = (request,response,next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1]
    }
    console.log(jwtToken)
    if(jwtToken === undefined){
        response.status(401);
        response.send("Invalid JWT Token");
    }else{
        jwt.verify(jwtToken,"My-secrete-token",async(error,payload) => {
            if(error){
                response.status(401);
                response.send("Invalid JWT Token")
            }else{
            next()
         }
        })
    }
}
//Create new transaction 

app.post("/transactions",async(request,response) => {
    const transactionsDetails = request.body;
    const {type,category,amount,date,description} = transactionsDetails;
    // console.log(transactionsDetails);
    const checkTypeInTransactions = `SELECT * FROM transactions WHERE type='{type}';`;
    if(checkTypeInTransactions === undefined){
        const createTransactionQuery = `
    INSERT 
    INTO 
    transactions
    (type,category,amount,date,description) 
    VALUES
    (
        '${type}',
        '${category}',
        ${amount},
        '${date}',
        '${description}'
    );`;
    const createTransactionResponse = await database.run(createTransactionQuery);
    const transactionId = createTransactionResponse.lastID;
    response.send(`Transaction created successfully at :${transactionId}`);
    }else{
        response.status(400);
        response.send("Transaction type already exists");
    }
    
})

//All transactions details

app.get("/transactions",async(request,response) => {
    const getAllTransactionQuery = `SELECT * FROM  transactions`;
    const allTransResponse = await database.all(getAllTransactionQuery);
    response.send(allTransResponse);
})

// Specific Transactions Details 

app.get("/transactions/:id",async(request,response) => {
    const {id} = request.params
    console.log(id);
    const getTransactionQuery = `SELECT * FROM  transactions WHERE id=${id};`;
    const transResponse = await database.get(getTransactionQuery);
    console.log(transResponse);
    response.send(transResponse);
})

//Update transaction details 

app.put("/transactions/:id",async(request,response) => {
    const {id} = request.params;
    const transactionDetails = request.body;
    const {type,category,amount,date,description} = transactionDetails;
    const checkUpdateTransaction = `SELECT * FROM transactions WHERE id=${id};`;
    const checkUpdateTransactionResponse = await database.run(checkUpdateTransaction);
    if(checkUpdateTransactionResponse === undefined){
        response.status(401);
        response.send(`Invalid Transaction Id: ${id}`)
    }else {
        const transactionUpdateQuery = `
            UPDATE 
            transactions 
            SET 
                type='${type}',
                category='${category}',
                amount=${amount},
                date='${date}',
                description='${description}'
            WHERE 
                id = ${id};`;
        await database.run(transactionUpdateQuery);
        response.send("Transaction Updated Successfully");
    }
})

//DELETE transaction

app.delete("/transactions/:id",async(request,response) => {
    const {id} = request.params;
    const getDeleteTransactionQuery = `SELECT * FROM transactions WHERE id=${id}`;
    if(getDeleteTransactionQuery === undefined){
        response.status(401);
        response.send(`Invalid Transaction ID: ${id}`)
    }else {
        const deleteQuery = `DELETE FROM transactions WHERE id=${id}`;
        await database.run(deleteQuery);
        response.send("Transaction Deleted Successfully");
    }
})

//GET Summary of Transactions 

app.get("/summary",async(request,response) => {
   const getSummary = `SELECT 
                            SUM(CASE WHEN type='income' then amount else 0 end ) as total_income,
                            SUM(CASE WHEN type='expense' then amount else 0 end ) as total_expense,
                            ((CASE WHEN type='income' then amount else 0 end )-(CASE WHEN type='expense' then amount else 0 end )) as balance
                    FROM transactions 
                    `;
    const summaryResponse  =await database.get(getSummary);
    response.send(summaryResponse);
    
});