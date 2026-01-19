import { Request } from 'express';
import { Screen } from '@prisma/client';

export interface RequestWithScreen extends Request {
  screen: Screen;
}
