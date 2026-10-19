import type { Request, Response } from "express";
import { authService } from "./auth.service.js";

export const authController = {
    async cadastrar (req: Request, res: Response): Promise<void>{
        const cliente = await authService.cadastrar(req.body)
        res.status(201).json(cliente)
    }
}
