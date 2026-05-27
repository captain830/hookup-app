const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('../middleware/auth');
const User = require('../models/User');
const db = require('../config/database');

const router = express.Router();

// Premium plans
const plans = {
    monthly: {
        priceId: 'price_monthly_xxx',
        amount: 19.99,
        coins: 100
    },
    quarterly: {
        priceId: 'price_quarterly_xxx',
        amount: 49.99,
        coins: 350
    },
    yearly: {
        priceId: 'price_yearly_xxx',
        amount: 99.99,
        coins: 1000
    }
};

// Create checkout session
router.post('/create-checkout-session', auth, async (req, res) => {
    const { planType } = req.body;
    const plan = plans[planType];
    
    if (!plan) {
        return res.status(400).json({ error: 'Invalid plan type.' });
    }
    
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
            metadata: {
                userId: req.userId,
                planType: planType,
                coinsToAdd: plan.coins
            }
        });
        
        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create coin purchase session
router.post('/buy-coins', auth, async (req, res) => {
    const { coinAmount, amount } = req.body;
    
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${coinAmount} Coins`,
                            description: `Purchase ${coinAmount} coins for the platform`,
                        },
                        unit_amount: amount * 100,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
            metadata: {
                userId: req.userId,
                coinAmount: coinAmount
            }
        });
        
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook handler for Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const { userId, planType, coinsToAdd, coinAmount } = session.metadata;
            
            if (planType) {
                // Premium subscription
                await User.updatePremium(userId, true);
                await User.addCoins(userId, parseInt(coinsToAdd));
            } else if (coinAmount) {
                // Coin purchase
                await User.addCoins(userId, parseInt(coinAmount));
            }
            
            // Record payment
            await db.query(
                'INSERT INTO payments (user_id, stripe_payment_id, amount, currency, status, plan_type) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, session.id, session.amount_total / 100, session.currency, session.payment_status, planType || 'coins']
            );
            break;
        case 'customer.subscription.deleted':
            // Handle subscription cancellation
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
});

module.exports = router;