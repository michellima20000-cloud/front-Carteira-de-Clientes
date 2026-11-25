import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

export default Router()
  // GET - Listar todos os clientes
  .get('/', async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, nome, email, created_at FROM clientes ORDER BY created_at DESC',
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // POST - Criar novo cliente
  .post('/', async (req: Request, res: Response) => {
    try {
      const { nome, email } = req.body;
      if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
      }
      const { rows } = await pool.query(
        'INSERT INTO clientes (nome, email, created_at) VALUES ($1, $2, NOW()) RETURNING id, nome, email, created_at',
        [nome, email],
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // GET - Buscar cliente por ID
  .get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'SELECT id, nome, email, created_at FROM clientes WHERE id = $1',
        [id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // PUT - Atualizar cliente
  .put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nome, email } = req.body;
      const { rows } = await pool.query(
        'UPDATE clientes SET nome = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING id, nome, email, created_at',
        [nome, email, id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // DELETE - Excluir cliente
  .delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json({ message: 'Cliente excluído com sucesso', id });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
