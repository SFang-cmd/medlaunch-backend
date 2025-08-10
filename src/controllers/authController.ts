import { Request, Response } from 'express';
import { login } from '../services/authService';


export async function loginController(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        const response = await login(email, password);
        res.json({ success: true, data: response });
    } catch (error) {
        res.status(401).json({
            success: false, 
            error: { message: "Login Failed" }
        });
    }
}