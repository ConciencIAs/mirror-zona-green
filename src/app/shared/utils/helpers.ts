import { PresentacionesProducto } from '@src/app/shared/models/interfaces/db/db';

export const getSaleUnitLabel = (unit?: PresentacionesProducto | null): string =>
	unit === 'mg' ? 'mg' : 'g';

export const getSaleUnitName = (unit?: PresentacionesProducto | null): string =>
	unit === 'mg' ? 'miligramos' : 'gramos';

export const fromGramsToSaleUnit = (
	grams: number | null | undefined,
	unit?: PresentacionesProducto | null,
): number => {
	if (grams == null) return 0;
	return unit === 'mg' ? grams * 1000 : grams;
};

export const toGramsFromSaleUnit = (
	amount: number,
	unit?: PresentacionesProducto | null,
): number => (unit === 'mg' ? amount / 1000 : amount);
