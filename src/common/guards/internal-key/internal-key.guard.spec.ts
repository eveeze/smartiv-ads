import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard', () => {
  it('should be defined', () => {
    expect(new InternalKeyGuard()).toBeDefined();
  });
});
