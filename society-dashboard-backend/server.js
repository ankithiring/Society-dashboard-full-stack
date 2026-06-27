const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from frontend folder
const path = require('path');
app.use(express.static(path.join(__dirname, '../society-dashboard-frontend')));

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account-key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Add your Sheet ID in .env

// ============ GET ENDPOINTS (Fetch Data) ============

// Get dashboard summary data
app.get('/api/dashboard/summary', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SocietyInfo!A2:B', // Skip header row
        });
        
        const data = {};
        response.data.values.forEach(row => {
            data[row[0]] = row[1];
        });
        
        // Calculate collection rate
        const collectionRate = (parseFloat(data.TotalCollected) / (parseFloat(data.TotalHouses) * 1500)) * 100;
        
        res.json({
            societyName: data.SocietyName,
            block: data.Block,
            totalHouses: data.TotalHouses,
            totalCollection: data.TotalCollected,
            totalExpenses: data.TotalExpenses,
            balanceLeft: data.BalanceLeft,
            collectionRate: collectionRate.toFixed(1)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get houses payment status
app.get('/api/houses', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Houses!A2:G', // Get all houses data
        });
        
        const houses = response.data.values.map(row => ({
            houseId: row[0],
            house: row[1],
            owner: row[2],
            dueAmount: row[3],
            paidAmount: row[4],
            status: row[5]
        }));
        
        res.json(houses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get expense breakdown
app.get('/api/expenses/breakdown', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ExpenseBreakdown!A2:C',
        });
        
        const categories = response.data.values.map(row => ({
            category: row[0],
            amount: parseFloat(row[1]),
            percentage: row[2]
        }));
        
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent transactions
app.get('/api/transactions/recent', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Transactions!A2:F',
        });
        
        const transactions = response.data.values.map(row => ({
            date: row[0],
            activity: row[1],
            amount: parseFloat(row[2]),
            type: row[3],
            status: row[4],
            houseOwner: row[5] || '-'
        }));
        
        // Return last 10 transactions sorted by date
        const recent = transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        res.json(recent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ POST ENDPOINTS (Add Data) ============

// Add payment for a house
app.post('/api/payments/add', async (req, res) => {
    const { houseId, amount, ownerName, date } = req.body;
    
    try {
        // 1. Add transaction record
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Transactions!A:F',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[date || new Date().toISOString().split('T')[0], 'Maintenance', amount, 'income', 'Completed', ownerName]]
            }
        });
        
        // 2. Update house paid amount
        const housesResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Houses!A2:G',
        });
        
        let houseRow = null;
        let rowIndex = null;
        
        housesResponse.data.values.forEach((row, index) => {
            if (row[0] === houseId) {
                houseRow = row;
                rowIndex = index + 2; // +2 because of 0-index and header row
            }
        });
        
        if (houseRow) {
            const currentPaid = parseFloat(houseRow[4]) || 0;
            const newPaid = currentPaid + parseFloat(amount);
            const dueAmount = parseFloat(houseRow[3]);
            const newStatus = newPaid >= dueAmount ? 'Completed' : 'Partial';
            
            // Update the house row
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Houses!E${rowIndex}:F${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[newPaid, newStatus]]
                }
            });
        }
        
        // 3. Update total collection in SocietyInfo
        const societyInfo = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SocietyInfo!A2:B',
        });
        
        let totalCollected = 0;
        societyInfo.data.values.forEach(row => {
            if (row[0] === 'TotalCollected') totalCollected = parseFloat(row[1]);
        });
        
        const newTotalCollected = totalCollected + parseFloat(amount);
        const balanceLeft = newTotalCollected - parseFloat(societyInfo.data.values.find(row => row[0] === 'TotalExpenses')?.[1] || 0);
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SocietyInfo!B2:B3',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newTotalCollected], [balanceLeft]]
            }
        });
        
        res.json({ success: true, message: 'Payment added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add expense
app.post('/api/expenses/add', async (req, res) => {
    const { category, amount, description, date } = req.body;
    
    try {
        // 1. Add transaction record
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Transactions!A:F',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[date || new Date().toISOString().split('T')[0], description || category, amount, 'expense', 'Paid', '-']]
            }
        });
        
        // 2. Update expense breakdown
        const breakdownResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ExpenseBreakdown!A2:C',
        });
        
        let categoryFound = false;
        let totalExpenses = 0;
        
        // Update category amount
        for (let i = 0; i < breakdownResponse.data.values.length; i++) {
            const row = breakdownResponse.data.values[i];
            if (row[0] === category) {
                const newAmount = parseFloat(row[1]) + parseFloat(amount);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `ExpenseBreakdown!B${i+2}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[newAmount]] }
                });
                categoryFound = true;
            }
            totalExpenses += parseFloat(row[1]);
        }
        
        // Update percentages
        totalExpenses += parseFloat(amount);
        const updatedBreakdown = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ExpenseBreakdown!A2:C',
        });
        
        for (let i = 0; i < updatedBreakdown.data.values.length; i++) {
            const row = updatedBreakdown.data.values[i];
            const newPercentage = ((parseFloat(row[1]) / totalExpenses) * 100).toFixed(0);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `ExpenseBreakdown!C${i+2}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[`${newPercentage}%`]] }
            });
        }
        
        // 3. Update total expenses in SocietyInfo
        const societyInfo = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SocietyInfo!A2:B',
        });
        
        let totalExpensesValue = 0;
        let totalCollected = 0;
        
        societyInfo.data.values.forEach(row => {
            if (row[0] === 'TotalExpenses') totalExpensesValue = parseFloat(row[1]);
            if (row[0] === 'TotalCollected') totalCollected = parseFloat(row[1]);
        });
        
        const newTotalExpenses = totalExpensesValue + parseFloat(amount);
        const newBalanceLeft = totalCollected - newTotalExpenses;
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SocietyInfo!B4:B5',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newTotalExpenses], [newBalanceLeft]]
            }
        });
        
        res.json({ success: true, message: 'Expense added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send reminder (just logs for now - can integrate email/SMS later)
app.post('/api/reminders/send', async (req, res) => {
    const { houseId, ownerName, dueAmount } = req.body;
    console.log(`Reminder sent to ${ownerName} (${houseId}): Due amount ${dueAmount}`);
    res.json({ success: true, message: `Reminder sent to ${ownerName}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});