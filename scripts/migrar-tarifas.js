// Pasa el catálogo del precio por asiento al precio por vehículo según
// cuánta gente va, usando los flyers de julio 2026 como fuente.
//
// Cada flyer se empató con la ruta que ya existe en la base (el nombre del
// sistema se conserva, así lo pidió el dueño):
//
//   Flyer                  ->  Ruta en el sistema
//   Las Brizas             ->  Senderos y Cascada        (rid 1)
//   Ruta Quexnol           ->  Ruta Gran Mirador         (rid 2)
//   Río Salvaje            ->  Ruta del Río              (rid 3)
//   La Calera              ->  La Ruta Clásica           (rid 4)
//   Ruta Nocturna          ->  Aventura Nocturna         (rid 5)
//   Ruta de Luciérnagas    ->  Luciérnagas               (rid 6)
//   Ruta Amanecer          ->  Amanecer en la Montaña    (rid 7)
//   Ruta 9 Aguas           ->  Experiencia Mezcal        (rid 8)
//   Brisas Nocturnas       ->  Cascada Iluminada         (rid 10)
//
// La rid 9 (Expedición al Volcán) no tiene flyer: se queda sin tarifas y
// por lo tanto no se muestra, hasta que el dueño mande sus precios.
//
// Se puede correr las veces que haga falta: siempre deja el mismo resultado.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';
import Unidad from '../models/Unidad.js';

dotenv.config();

// Las 5 categorías comerciales. El id es el que ya usa la base.
const CATEGORIAS = [
  { id: 'cuatrimoto-2', name: 'Cuatrimoto',      type: 'ATV 2 plazas', seats: 2 },
  { id: 'commander-2',  name: 'Commander Trail', type: 'SSV 2 plazas', seats: 2 },
  { id: 'commander-4',  name: 'Commander Max',   type: 'SSV 4 plazas', seats: 4 },
  { id: 'maverick-2',   name: 'Maverick X3',     type: 'SSV 2 plazas', seats: 2 },
  { id: 'maverick-4',   name: 'Maverick X3 MAX', type: 'SSV 4 plazas', seats: 4 }
];

// Precios tal cual vienen impresos en los flyers.
//   cuatrimoto: [1 persona, 2 personas]
//   commander / maverick: [2 personas, 3 personas, 4 personas]
const FLYERS = {
  1:  { flyer: 'Las Brizas',          cuatrimoto: [1800, 2300], commander: [3000, 3800, 4600], maverick: [4000, 4800, 5600] },
  2:  { flyer: 'Ruta Quexnol',        cuatrimoto: [2600, 2800], commander: [3800, 4300, 4800], maverick: [4800, 5300, 5800] },
  3:  { flyer: 'Río Salvaje',         cuatrimoto: [1200, 1400], commander: [2100, 2600, 3100], maverick: [3100, 3600, 4100] },
  4:  { flyer: 'La Calera',           cuatrimoto: [1500, 1700], commander: [2300, 2800, 3300], maverick: [3300, 3800, 4300] },
  5:  { flyer: 'Ruta Nocturna',       cuatrimoto: [1700, 1900], commander: [2700, 3200, 3700], maverick: [3700, 4200, 4700] },
  6:  { flyer: 'Ruta de Luciérnagas', cuatrimoto: [2200, 2600], commander: [3300, 3800, 4400], maverick: [4300, 4800, 5400] },
  7:  { flyer: 'Ruta Amanecer',       cuatrimoto: [2800, 3000], commander: [4100, 4300, 4800], maverick: [5100, 5300, 5800] },
  8:  { flyer: 'Ruta 9 Aguas',        cuatrimoto: [1700, 2200], commander: [2800, 3600, 4300], maverick: [3800, 4600, 5300] },
  10: { flyer: 'Brisas Nocturnas',    cuatrimoto: [1900, 2600], commander: [3200, 4200, 4900], maverick: [4200, 5200, 5900] }
};

// Los flyers cotizan la cuatrimoto desde 1 persona y los SSV desde 2.
// Las versiones de 2 plazas se quedan con la tarifa de 2 personas de su
// familia: no hay precio impreso para ir solo en un SSV, así que no se inventa.
function tarifasDe(categoriaId, precios) {
  switch (categoriaId) {
    case 'cuatrimoto-2': return [{ personas: 1, precio: precios.cuatrimoto[0] }, { personas: 2, precio: precios.cuatrimoto[1] }];
    case 'commander-2':  return [{ personas: 2, precio: precios.commander[0] }];
    case 'commander-4':  return [2, 3, 4].map((p, i) => ({ personas: p, precio: precios.commander[i] }));
    case 'maverick-2':   return [{ personas: 2, precio: precios.maverick[0] }];
    case 'maverick-4':   return [2, 3, 4].map((p, i) => ({ personas: p, precio: precios.maverick[i] }));
    default: return [];
  }
}

async function migrar() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  // 1. Apodo de la flota: Don Mabel pasa a Don Mave
  const apodo = await Unidad.updateOne({ codigo: 'MAV2-01' }, { $set: { apodo: 'Don Mave' } });
  console.log(apodo.modifiedCount ? 'Flotilla: Don Mabel -> Don Mave' : 'Flotilla: el apodo ya estaba bien');

  // 2. Tarifas por ruta
  let actualizadas = 0;
  for (const [rid, precios] of Object.entries(FLYERS)) {
    const ruta = await Ruta.findOne({ rid: Number(rid) });
    if (!ruta) { console.log(`! rid ${rid}: no existe, se salta`); continue; }

    // Toda ruta ofrece las 5 categorías: los flyers anuncian las tres
    // familias en todas, y hoy varias rutas no traen ni cuatrimoto.
    ruta.units = CATEGORIAS.map(cat => {
      const previa = ruta.units.find(u => u.id === cat.id);
      const tarifas = tarifasDe(cat.id, precios);
      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        seats: cat.seats,
        tarifas,
        // el campo viejo se queda con la tarifa de entrada: si el sitio
        // todavía no se actualiza, muestra un número real y no cero
        price: tarifas.length ? tarifas[0].precio : 0,
        booked: (previa?.booked || []).filter(n => n >= 1 && n <= cat.seats),
        activo: previa ? previa.activo : true
      };
    });

    ruta.actualizadaEn = new Date();
    await ruta.save();
    actualizadas++;
    console.log(`OK  ${ruta.name}  (flyer: ${precios.flyer})`);
  }

  // 3. La ruta sin flyer se queda sin tarifas para que no muestre precios viejos
  const sinFlyer = await Ruta.findOne({ rid: 9 });
  if (sinFlyer) {
    sinFlyer.units.forEach(u => { u.tarifas = []; u.price = 0; });
    sinFlyer.actualizadaEn = new Date();
    await sinFlyer.save();
    console.log(`\n!  ${sinFlyer.name} (rid 9) quedó sin tarifas: falta su flyer.`);
  }

  console.log(`\nRutas actualizadas: ${actualizadas}`);
  await mongoose.connection.close();
  process.exit(0);
}

migrar().catch(err => {
  console.error('Falló la migración:', err.message);
  process.exit(1);
});
