import mongoose from 'mongoose';

// Nombre comercial de cada categoría. ESTA es la única fuente: el nombre que
// quedó copiado dentro de cada ruta (Ruta.units[].name) se ignora al servir,
// porque si no habría que tocar diez documentos para renombrar una máquina.
// El código interno (CMD2-01, tipo "commander") no cambia: las reservas ya
// emitidas lo referencian y el índice de doble reserva depende de él.
export const NOMBRE_CATEGORIA = {
  'cuatrimoto-2': 'Cuatrimoto',
  'commander-2': 'Maverick Trail',
  'commander-4': 'Commander Max',
  'maverick-2': 'Maverick X3 RS',
  'maverick-4': 'Maverick X3'
};

// Máquina física de la flota. Existe una sola vez y sirve para todas las rutas:
// si se aparta el sábado a las 09:00, queda ocupada a esa hora sin importar en qué ruta se haya reservado.
const unidadSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },   // CUAD-01, CMD4-01, MAV4-01
  apodo: { type: String, required: true },                  // Blue, Comandante, Máximo
  tipo: { type: String, required: true, enum: ['cuatrimoto', 'commander', 'maverick'] },
  plazas: { type: Number, required: true, min: 1, max: 12 },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  imagen: { type: String, default: '' },                    // URL a PNG de la unidad
  creadaEn: { type: Date, default: Date.now }
});

// Identifica la configuración comercial (maverick-4, commander-2, cuatrimoto-2)
unidadSchema.virtual('tipoId').get(function () {
  return `${this.tipo}-${this.plazas}`;
});

// Legible para admin y cliente: "Maverick X3 MAX · Máximo".
unidadSchema.virtual('nombreCompleto').get(function () {
  return `${NOMBRE_CATEGORIA[this.tipoId] || this.tipo} · ${this.apodo}`;
});

unidadSchema.set('toJSON', { virtuals: true });
unidadSchema.set('toObject', { virtuals: true });


export const ETIQUETAS_TIPO = {
  cuatrimoto: 'Cuatrimoto',
  maverick: 'Maverick X3',
  commander: 'Commander Max'
};

export const tipoIdLegible = (tipoId) => {
  const [tipo, plazas] = String(tipoId).split('-');
  return `${NOMBRE_CATEGORIA[tipoId] || ETIQUETAS_TIPO[tipo] || tipo} · ${plazas} plazas`;
};

// FLOTA REAL según especificación del usuario.
// `orden` es además el número de la máquina: la 1 y la 2 son las motos y de
// ahí se sigue hasta la 12, agrupadas por familia. El panel las muestra como
// "Unidad 7 · Don Mave" para que en el taller y en el calendario todos se
// refieran a la misma máquina sin depender del apodo.
export const FLOTA = [
  // Cuatrimotos (2 plazas)
  { codigo: 'CUAD-01', apodo: 'Blue', tipo: 'cuatrimoto', plazas: 2, orden: 1 },
  { codigo: 'CUAD-02', apodo: 'Red', tipo: 'cuatrimoto', plazas: 2, orden: 2 },

  // Commanders
  { codigo: 'CMD2-01', apodo: 'Minimi', tipo: 'commander', plazas: 2, orden: 3 },
  { codigo: 'CMD4-01', apodo: 'Comandante', tipo: 'commander', plazas: 4, orden: 4 },
  { codigo: 'CMD4-02', apodo: 'Titán', tipo: 'commander', plazas: 4, orden: 5 },
  { codigo: 'CMD4-03', apodo: 'Ares', tipo: 'commander', plazas: 4, orden: 6 },

  // Mavericks
  { codigo: 'MAV2-01', apodo: 'Don Mave', tipo: 'maverick', plazas: 2, orden: 7 },
  { codigo: 'MAV4-01', apodo: 'Máximo', tipo: 'maverick', plazas: 4, orden: 8 },
  { codigo: 'MAV4-02', apodo: 'Espartano', tipo: 'maverick', plazas: 4, orden: 9 },
  { codigo: 'MAV4-03', apodo: 'RS', tipo: 'maverick', plazas: 4, orden: 10 },
  { codigo: 'MAV4-04', apodo: 'Black', tipo: 'maverick', plazas: 4, orden: 11 },
  { codigo: 'MAV4-05', apodo: 'Gladio', tipo: 'maverick', plazas: 4, orden: 12 }
];

export default mongoose.model('Unidad', unidadSchema);
