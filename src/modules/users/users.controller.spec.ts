import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return page dto', async () => {
      const mockResult = new PageDto(
        [],
        new PageMetaDto({ itemCount: 0, pageOptionsDto: new PageOptionsDto() }),
      );

      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(new PageOptionsDto());
      expect(result).toBe(mockResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user detail', async () => {
      const mockUser = { id: 1, name: 'User 1' };
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(1);
      expect(result).toBe(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });
});
