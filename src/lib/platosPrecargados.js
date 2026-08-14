// Platos completos precargados para el registro rápido de comidas.
// Cada "ingrediente" referencia un alimento por su nombre EXACTO en
// BASE_ALIMENTOS (src/lib/baseAlimentos.js) + la cantidad en gramos con la
// que suele comerse. Al elegir un plato, Nutricion.jsx resuelve cada
// ingrediente contra la base local y agrega todos los ítems al plato en
// construcción — el usuario después puede sumar, quitar o ajustar cantidades.

export const PLATOS_PRECARGADOS = [
  {
    nombre: 'Avocado toast con huevos revueltos',
    tipo: 'Desayuno',
    ingredientes: [
      { alimento: 'Pan integral', gramos: 60 },
      { alimento: 'Palta (aguacate)', gramos: 100 },
      { alimento: 'Huevo entero', gramos: 100 },
    ],
  },
  {
    nombre: 'Pollo con arroz',
    tipo: 'Almuerzo',
    ingredientes: [
      { alimento: 'Pechuga de pollo cocida', gramos: 150 },
      { alimento: 'Arroz blanco cocido', gramos: 200 },
    ],
  },
  {
    nombre: 'Carne con arroz',
    tipo: 'Almuerzo',
    ingredientes: [
      { alimento: 'Carne vacuna magra cocida', gramos: 150 },
      { alimento: 'Arroz blanco cocido', gramos: 200 },
    ],
  },
  {
    nombre: 'Pollo con fideos',
    tipo: 'Almuerzo',
    ingredientes: [
      { alimento: 'Pechuga de pollo cocida', gramos: 150 },
      { alimento: 'Pasta cocida', gramos: 200 },
    ],
  },
  {
    nombre: 'Bowl de pollo, arroz integral y palta',
    tipo: 'Almuerzo',
    ingredientes: [
      { alimento: 'Pechuga de pollo cocida', gramos: 150 },
      { alimento: 'Arroz integral cocido', gramos: 150 },
      { alimento: 'Palta (aguacate)', gramos: 50 },
    ],
  },
  {
    nombre: 'Tostado de jamón y queso',
    tipo: 'Merienda',
    ingredientes: [
      { alimento: 'Pan blanco', gramos: 60 },
      { alimento: 'Jamón cocido', gramos: 40 },
      { alimento: 'Queso port salut / cremoso', gramos: 30 },
    ],
  },
  {
    nombre: 'Ensalada de atún',
    tipo: 'Cena',
    ingredientes: [
      { alimento: 'Atún al natural (lata)', gramos: 120 },
      { alimento: 'Lechuga', gramos: 50 },
      { alimento: 'Tomate', gramos: 100 },
      { alimento: 'Aceite de oliva', gramos: 10 },
    ],
  },
  {
    nombre: 'Tortilla de claras con avena y frutilla',
    tipo: 'Desayuno',
    ingredientes: [
      { alimento: 'Clara de huevo', gramos: 165 },
      { alimento: 'Avena cocida', gramos: 150 },
      { alimento: 'Frutilla', gramos: 100 },
    ],
  },
  {
    nombre: 'Batido post-entreno',
    tipo: 'Intra-entreno',
    ingredientes: [
      { alimento: 'ENA 100% Whey Protein (polvo)', gramos: 36 },
      { alimento: 'Banana', gramos: 118 },
      { alimento: 'Leche descremada', gramos: 200 },
    ],
  },
]
