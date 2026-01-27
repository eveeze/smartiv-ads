import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return true;
  }
}
