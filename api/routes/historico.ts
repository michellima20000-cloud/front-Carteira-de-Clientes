import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

export default Router()
  // GET - Listar histórico de clientes
  .get('/', async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, cliente_id, acao, descricao, created_at FROM historico ORDER BY created_at DESC',
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar histórico:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // POST - Registrar nova ação no histórico
  .post('/', async (req: Request, res: Response) => {
    try {
      const { cliente_id, acao, descricao } = req.body;
      if (!cliente_id || !acao) {
        return res.status(400).json({ error: 'cliente_id e acao são obrigatórios' });
      }
      const { rows } = await pool.query(
        'INSERT INTO historico (cliente_id, acao, descricao, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, cliente_id, acao, descricao, created_at',
        [cliente_id, acao, descricao || ''],
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // GET - Histórico por cliente
  .get('/cliente/:clienteId', async (req: Request, res: Response) => {
    try {
      const { clienteId } = req.params;
      const { rows } = await pool.query(
        'SELECT id, acao, descricao, created_at FROM historico WHERE cliente_id = $1 ORDER BY created_at DESC',
        [clienteId],
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar histórico por cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
