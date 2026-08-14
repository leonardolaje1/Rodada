// Base de datos local de alimentos frecuentes para deportistas de endurance.
// Todos los valores son macros por 100g de porción comestible, de fuentes
// nutricionales estándar (USDA / tablas de composición de alimentos).
// Búsqueda instantánea, sin red, sin API key — pensada para cubrir el 90%
// de los casos de uso diarios. Para algo que no esté acá, el buscador cae
// automáticamente a USDA FoodData Central / Open Food Facts.
//
// Formato: [nombre, categoria, kcal, proteínas(g), carbohidratos(g), grasas(g), unidad?]
// "unidad" es opcional: { etiqueta, gramos } para alimentos que se comen por
// pieza (huevo, banana, palta...) en vez de pesarse. Si no está presente,
// el alimento solo se carga por gramos.

const DATA = [
  // ===== Cereales, granos y derivados =====
  ['Arroz blanco cocido', 'Cereales', 130, 2.7, 28, 0.3],
  ['Arroz integral cocido', 'Cereales', 123, 2.6, 25.6, 1],
  ['Avena arrollada cruda', 'Cereales', 389, 16.9, 66.3, 6.9],
  ['Avena cocida', 'Cereales', 71, 2.5, 12, 1.5],
  ['Quinoa cocida', 'Cereales', 120, 4.4, 21.3, 1.9],
  ['Pasta seca cruda', 'Cereales', 371, 13, 74.7, 1.5],
  ['Pasta cocida', 'Cereales', 158, 5.8, 30.9, 0.9],
  ['Pan blanco', 'Cereales', 265, 9, 49, 3.2],
  ['Pan integral', 'Cereales', 247, 13, 41, 3.4],
  ['Pan francés / baguette', 'Cereales', 274, 9.1, 55.4, 1.5, { etiqueta: 'pan chico', gramos: 60 }],
  ['Tostadas', 'Cereales', 407, 11, 76, 5.8, { etiqueta: 'tostada', gramos: 25 }],
  ['Galletas de arroz', 'Cereales', 387, 8.2, 81.5, 2.8, { etiqueta: 'galleta', gramos: 9 }],
  ['Copos de maíz (corn flakes)', 'Cereales', 357, 7.5, 84, 0.4],
  ['Granola', 'Cereales', 471, 10, 64, 20],
  ['Harina de trigo', 'Cereales', 364, 10.3, 76.3, 1],
  ['Harina de maíz', 'Cereales', 361, 8.1, 76.9, 3.6],
  ['Polenta cocida', 'Cereales', 85, 2, 18, 0.5],
  ['Fideos de arroz', 'Cereales', 109, 1.8, 25, 0.2],
  ['Cuscús cocido', 'Cereales', 112, 3.8, 23.2, 0.2],
  ['Cebada perlada cocida', 'Cereales', 123, 2.3, 28.2, 0.4],

  // ===== Legumbres =====
  ['Lentejas cocidas', 'Legumbres', 116, 9, 20, 0.4],
  ['Garbanzos cocidos', 'Legumbres', 164, 8.9, 27.4, 2.6],
  ['Porotos negros cocidos', 'Legumbres', 132, 8.9, 23.7, 0.5],
  ['Porotos blancos cocidos', 'Legumbres', 127, 8.7, 23, 0.5],
  ['Arvejas cocidas', 'Legumbres', 84, 5.4, 14.5, 0.4],
  ['Soja cocida', 'Legumbres', 173, 16.6, 9.9, 9],
  ['Hummus', 'Legumbres', 166, 7.9, 14.3, 9.6],

  // ===== Frutas =====
  ['Banana', 'Frutas', 89, 1.1, 22.8, 0.3, { etiqueta: 'banana', gramos: 118 }],
  ['Manzana', 'Frutas', 52, 0.3, 13.8, 0.2, { etiqueta: 'manzana', gramos: 182 }],
  ['Naranja', 'Frutas', 47, 0.9, 11.8, 0.1, { etiqueta: 'naranja', gramos: 131 }],
  ['Palta (aguacate)', 'Frutas', 160, 2, 8.5, 14.7, { etiqueta: 'palta', gramos: 200 }],
  ['Frutilla', 'Frutas', 32, 0.7, 7.7, 0.3, { etiqueta: 'frutilla', gramos: 12 }],
  ['Uva', 'Frutas', 69, 0.7, 18.1, 0.2, { etiqueta: 'grano', gramos: 5 }],
  ['Pera', 'Frutas', 57, 0.4, 15.2, 0.1, { etiqueta: 'pera', gramos: 178 }],
  ['Kiwi', 'Frutas', 61, 1.1, 14.7, 0.5, { etiqueta: 'kiwi', gramos: 76 }],
  ['Ananá (piña)', 'Frutas', 50, 0.5, 13.1, 0.1],
  ['Mango', 'Frutas', 60, 0.8, 15, 0.4, { etiqueta: 'mango', gramos: 200 }],
  ['Melón', 'Frutas', 34, 0.8, 8.2, 0.2],
  ['Sandía', 'Frutas', 30, 0.6, 7.6, 0.2],
  ['Durazno', 'Frutas', 39, 0.9, 9.5, 0.3, { etiqueta: 'durazno', gramos: 150 }],
  ['Ciruela', 'Frutas', 46, 0.7, 11.4, 0.3, { etiqueta: 'ciruela', gramos: 66 }],
  ['Arándanos', 'Frutas', 57, 0.7, 14.5, 0.3],
  ['Frutos secos deshidratados (mix)', 'Frutas', 350, 5, 75, 3],
  ['Dátiles', 'Frutas', 282, 2.5, 75, 0.4, { etiqueta: 'dátil', gramos: 8 }],
  ['Pasas de uva', 'Frutas', 299, 3.1, 79.2, 0.5],
  ['Higo fresco', 'Frutas', 74, 0.8, 19.2, 0.3, { etiqueta: 'higo', gramos: 50 }],
  ['Limón', 'Frutas', 29, 1.1, 9.3, 0.3, { etiqueta: 'limón', gramos: 58 }],

  // ===== Verduras =====
  ['Papa cocida', 'Verduras', 87, 1.9, 20.1, 0.1, { etiqueta: 'papa mediana', gramos: 150 }],
  ['Batata / boniato cocida', 'Verduras', 90, 2, 20.7, 0.1, { etiqueta: 'batata mediana', gramos: 150 }],
  ['Zanahoria', 'Verduras', 41, 0.9, 9.6, 0.2, { etiqueta: 'zanahoria', gramos: 61 }],
  ['Tomate', 'Verduras', 18, 0.9, 3.9, 0.2, { etiqueta: 'tomate', gramos: 123 }],
  ['Lechuga', 'Verduras', 15, 1.4, 2.9, 0.2],
  ['Cebolla', 'Verduras', 40, 1.1, 9.3, 0.1, { etiqueta: 'cebolla', gramos: 110 }],
  ['Brócoli cocido', 'Verduras', 35, 2.4, 7.2, 0.4],
  ['Espinaca cruda', 'Verduras', 23, 2.9, 3.6, 0.4],
  ['Zapallo / calabaza cocida', 'Verduras', 26, 1, 6.5, 0.1],
  ['Choclo (maíz) cocido', 'Verduras', 96, 3.4, 21, 1.5, { etiqueta: 'mazorca', gramos: 90 }],
  ['Zapallito / calabacín', 'Verduras', 17, 1.2, 3.1, 0.3, { etiqueta: 'zapallito', gramos: 118 }],
  ['Pepino', 'Verduras', 15, 0.7, 3.6, 0.1],
  ['Pimiento morrón', 'Verduras', 31, 1, 6, 0.3, { etiqueta: 'morrón', gramos: 119 }],
  ['Berenjena cocida', 'Verduras', 33, 0.8, 8.1, 0.2],
  ['Champiñones', 'Verduras', 22, 3.1, 3.3, 0.3],
  ['Remolacha cocida', 'Verduras', 44, 1.7, 10, 0.2],
  ['Acelga cocida', 'Verduras', 20, 1.8, 3.7, 0.2],
  ['Apio', 'Verduras', 16, 0.7, 3, 0.2],

  // ===== Carnes, pescados y huevos =====
  ['Pechuga de pollo cocida', 'Proteínas', 165, 31, 0, 3.6],
  ['Muslo de pollo cocido', 'Proteínas', 209, 26, 0, 10.9],
  ['Carne vacuna magra cocida', 'Proteínas', 217, 26.1, 0, 11.8],
  ['Bife de lomo cocido', 'Proteínas', 201, 27.4, 0, 9.4],
  ['Carne picada magra cocida', 'Proteínas', 218, 26.4, 0, 11.7],
  ['Cerdo (lomo) cocido', 'Proteínas', 143, 26, 0, 3.5],
  ['Pescado blanco (merluza) cocido', 'Proteínas', 90, 19.6, 0, 0.8],
  ['Salmón cocido', 'Proteínas', 208, 20.4, 0, 13.4],
  ['Atún al natural (lata)', 'Proteínas', 116, 25.5, 0, 0.8],
  ['Atún al aceite (lata, escurrido)', 'Proteínas', 198, 23.6, 0, 10.9],
  ['Sardinas en lata', 'Proteínas', 208, 24.6, 0, 11.5],
  ['Camarones cocidos', 'Proteínas', 99, 24, 0.2, 0.3],
  ['Huevo entero', 'Proteínas', 155, 12.6, 1.1, 10.6, { etiqueta: 'huevo', gramos: 50 }],
  ['Clara de huevo', 'Proteínas', 52, 10.9, 0.7, 0.2, { etiqueta: 'clara', gramos: 33 }],
  ['Jamón cocido', 'Proteínas', 145, 21, 1.5, 5.5],
  ['Pechuga de pavo', 'Proteínas', 135, 30, 0, 1],
  ['Hígado vacuno cocido', 'Proteínas', 175, 26.5, 3.9, 4.9],

  // ===== Lácteos =====
  ['Leche entera', 'Lácteos', 61, 3.2, 4.8, 3.3],
  ['Leche descremada', 'Lácteos', 34, 3.4, 5, 0.1],
  ['Yogur natural entero', 'Lácteos', 61, 3.5, 4.7, 3.3],
  ['Yogur natural descremado', 'Lácteos', 56, 5.7, 7.7, 0.2],
  ['Yogur griego natural', 'Lácteos', 97, 9, 3.9, 5],
  ['Queso fresco / cottage', 'Lácteos', 98, 11.1, 3.4, 4.3],
  ['Queso untable descremado', 'Lácteos', 130, 8, 5, 8],
  ['Queso port salut / cremoso', 'Lácteos', 350, 22, 1.5, 28],
  ['Queso rallado (parmesano)', 'Lácteos', 431, 38, 4.1, 29],
  ['Ricota', 'Lácteos', 174, 11.3, 3, 13],
  ['Dulce de leche', 'Lácteos', 315, 6.4, 55.4, 6.7],
  ['Manteca / mantequilla', 'Lácteos', 717, 0.9, 0.1, 81.1],

  // ===== Frutos secos, semillas y grasas =====
  ['Almendras', 'Frutos secos', 579, 21.2, 21.6, 49.9],
  ['Nueces', 'Frutos secos', 654, 15.2, 13.7, 65.2],
  ['Maní / cacahuate', 'Frutos secos', 567, 25.8, 16.1, 49.2],
  ['Manteca de maní', 'Frutos secos', 588, 25, 20, 50],
  ['Castañas de cajú', 'Frutos secos', 553, 18.2, 30.2, 43.9],
  ['Semillas de chía', 'Frutos secos', 486, 16.5, 42.1, 30.7],
  ['Semillas de lino', 'Frutos secos', 534, 18.3, 28.9, 42.2],
  ['Semillas de girasol', 'Frutos secos', 584, 20.8, 20, 51.5],
  ['Aceite de oliva', 'Grasas', 884, 0, 0, 100],
  ['Aceite de girasol', 'Grasas', 884, 0, 0, 100],
  ['Palta / guacamole', 'Grasas', 155, 2, 8.5, 13.7],
  ['Aceitunas', 'Grasas', 115, 0.8, 6.3, 10.7],
  ['Coco rallado', 'Grasas', 660, 6.9, 23.7, 64.5],

  // ===== Nutrición deportiva =====
  ['Gel energético (genérico)', 'Nutrición deportiva', 260, 0, 65, 0, { etiqueta: 'gel', gramos: 40 }],
  ['Barra energética (genérica)', 'Nutrición deportiva', 380, 8, 65, 9, { etiqueta: 'barra', gramos: 45 }],
  ['Barra de proteína (genérica)', 'Nutrición deportiva', 350, 25, 35, 12, { etiqueta: 'barra', gramos: 60 }],
  ['Bebida isotónica (polvo, preparada)', 'Nutrición deportiva', 25, 0, 6, 0],
  ['Bebida isotónica comercial (lista)', 'Nutrición deportiva', 24, 0, 6, 0],
  ['Proteína whey (polvo, genérica)', 'Nutrición deportiva', 380, 78, 8, 6],
  ['Maltodextrina (polvo)', 'Nutrición deportiva', 380, 0, 95, 0],
  ['Electrolitos (pastilla/sobre, sin kcal)', 'Nutrición deportiva', 5, 0, 1, 0],
  ['Cafeína (cápsula, sin kcal relevante)', 'Nutrición deportiva', 0, 0, 0, 0],
  ['Barrita de cereal', 'Nutrición deportiva', 400, 6, 70, 12],
  ['Recovery drink (polvo, genérico)', 'Nutrición deportiva', 380, 20, 60, 5],

  // ===== Proteínas en polvo y barras — marcas reales (AR + mundo) =====
  // Valores normalizados a 100g a partir de la porción declarada en el
  // envase/sitio oficial de cada marca. "unidad" refleja la porción real
  // de venta (scoop o barra) para que el buscador pueda cargarla en 1 tap.
  ['ENA 100% Whey Protein (polvo)', 'Nutrición deportiva', 403, 55.6, 33.3, 5.3, { etiqueta: 'scoop', gramos: 36 }],
  ['GenTech Whey Protein 7900 AFA (polvo)', 'Nutrición deportiva', 427, 73.3, 11, 9.7, { etiqueta: 'scoop', gramos: 30 }],
  ['Star Nutrition Platinum Whey (polvo)', 'Nutrición deportiva', 423, 83.3, 8.7, 6, { etiqueta: 'scoop', gramos: 30 }],
  ['Optimum Nutrition Gold Standard 100% Whey (polvo)', 'Nutrición deportiva', 395, 78.9, 9.9, 3.3, { etiqueta: 'scoop', gramos: 30 }],
  ['MyProtein Impact Whey Protein (polvo)', 'Nutrición deportiva', 392, 78.4, 6, 6.8, { etiqueta: 'scoop', gramos: 25 }],
  ['ENA Protein Bar (barrita)', 'Nutrición deportiva', 428, 32.6, 52.2, 10.9, { etiqueta: 'barrita', gramos: 46 }],
  ['Quest Bar (barrita)', 'Nutrición deportiva', 333, 33.3, 35, 13.3, { etiqueta: 'barrita', gramos: 60 }],

  // ===== Panificados, dulces y otros =====
  ['Miel', 'Otros', 304, 0.3, 82.4, 0],
  ['Mermelada', 'Otros', 278, 0.4, 69, 0.1],
  ['Azúcar', 'Otros', 387, 0, 100, 0],
  ['Chocolate con leche', 'Otros', 535, 7.7, 59.4, 29.7],
  ['Chocolate amargo (70%)', 'Otros', 598, 7.8, 45.9, 42.6],
  ['Alfajor (genérico)', 'Otros', 430, 5, 60, 19, { etiqueta: 'alfajor', gramos: 50 }],
  ['Facturas / medialunas', 'Otros', 406, 7.8, 45.8, 21.5, { etiqueta: 'medialuna', gramos: 40 }],
  ['Bizcochuelo', 'Otros', 297, 6, 50, 8],
  ['Papas fritas (snack)', 'Otros', 536, 6.6, 53, 34.6],
  ['Pizza (porción, genérica)', 'Otros', 266, 11, 33, 10, { etiqueta: 'porción', gramos: 125 }],
  ['Empanada (genérica, horneada)', 'Otros', 260, 9, 25, 13, { etiqueta: 'empanada', gramos: 90 }],

  // ===== Bebidas =====
  ['Agua', 'Bebidas', 0, 0, 0, 0],
  ['Café negro', 'Bebidas', 1, 0.1, 0, 0],
  ['Té', 'Bebidas', 1, 0, 0.2, 0],
  ['Jugo de naranja natural', 'Bebidas', 45, 0.7, 10.4, 0.2],
  ['Gaseosa cola', 'Bebidas', 42, 0, 10.6, 0],
  ['Cerveza', 'Bebidas', 43, 0.5, 3.6, 0],
  ['Vino tinto', 'Bebidas', 85, 0.1, 2.6, 0],
]

export const BASE_ALIMENTOS = DATA.map(([nombre, categoria, kcal100g, proteinas100g, carbohidratos100g, grasas100g, unidad]) => ({
  nombre, categoria, kcal100g, proteinas100g, carbohidratos100g, grasas100g, unidad: unidad || null
}))

// Búsqueda instantánea (sin red): coincidencias por texto, con las que
// empiezan con el término buscado primero.
export function buscarAlimentosLocal(texto, limite = 10) {
  const t = (texto || '').trim().toLowerCase()
  if (t.length < 2) return []
  const empiezan = []
  const contienen = []
  for (const item of BASE_ALIMENTOS) {
    const n = item.nombre.toLowerCase()
    if (n.startsWith(t)) empiezan.push(item)
    else if (n.includes(t)) contienen.push(item)
  }
  return [...empiezan, ...contienen].slice(0, limite)
}
