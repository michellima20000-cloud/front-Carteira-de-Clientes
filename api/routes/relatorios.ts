import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

export default Router()
  // GET - Resumo de clientes (total, novos, etc.)
  .get('/resumo', async (_req: Request, res: Response) => {
    try {
      // Total de clientes
      const { rows: totalRows } = await pool.query('SELECT COUNT(*) as total FROM clientes');
      // Novos clientes do mês atual
      const { rows: newRows } = await pool.query(
        `SELECT COUNT(*) as novos FROM clientes WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
      );
      // Total de ações no histórico
      const { rows: histRows } = await pool.query('SELECT COUNT(*) as total_acoes FROM historico');
      // Última atividade
      const { rows: lastRow } = await pool.query(
        'SELECT MAX(created_at) as ultima_atividade FROM (SELECT created_at FROM clientes UNION ALL SELECT created_at FROM historico) sub',
      );

      res.json({
        totalClientes: totalRows[0].total,
        novosEsteMes: newRows[0].novos,
        totalAcoesHistorico: histRows[0].total_acoes,
        ultimaAtividade: lastRow.ultima_atividade,
      });
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // GET - Clientes por período
  .get('/por-periodo', async (_req: Request, res: Response) => {
    try {
      const { startDate, endDate } = _req.query as {
        startDate: string | Date;
        endDate: string | Date;
      };
      const values: (string | Date)[] = [];

      const queryString = `
        SELECT COUNT(*) as total, DATE(created_at) as data
        FROM clientes
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY data DESC
      `;

      if (startDate && endDate) {
        values.push(startDate);
        values.push(endDate);
      } else {
        // Default: últimos 30 dias
        values.push(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        values.push(new Date());
      }

      const { rows } = await pool.query(queryString, values);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao buscar clientes por período:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  })

  // GET - Estatísticas do histórico
  .get('/historico/estatisticas', async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          acao,
          COUNT(*) as total,
          COUNT(DISTINCT cliente_id) as clientes_afetados
        FROM historico
        GROUP BY acao
        ORDER BY total DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao obter estatísticas do histórico:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
