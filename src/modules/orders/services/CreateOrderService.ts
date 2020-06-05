import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const productsIds = products.map(product => ({ id: product.id }));

    const productsDB = await this.productsRepository.findAllById(productsIds);

    const orderProducts = products.map(product => {
      const productDB = productsDB.find(
        findProduct => findProduct.id === product.id,
      );

      if (!productDB) {
        throw new AppError(`Product with id: ${product.id}, does not exist`);
      }

      if (productDB.quantity < product.quantity) {
        throw new AppError(
          `There is insuficient stock available for the product: ${productDB.name}`,
        );
      }

      productDB.quantity -= product.quantity;

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productDB.price,
      };
    });

    await this.productsRepository.updateQuantity(productsDB);

    const productSaved = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return productSaved;
  }
}

export default CreateOrderService;
