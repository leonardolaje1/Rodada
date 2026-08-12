export const NIVELES_ACTIVIDAD = [
  { id: 'sedentario', label: 'Sedentario', factor: 1.2 },
  { id: 'ligero', label: 'Entreno ligero (1-3 d/sem)', factor: 1.375 },
  { id: 'moderado', label: 'Entreno moderado (3-5 d/sem)', factor: 1.55 },
  { id: 'alto', label: 'Entreno intenso (6-7 d/sem)', factor: 1.725 },
  { id: 'muy_alto', label: 'Doble sesión / muy intenso', factor: 1.9 }
]

export function calcularBMR({ peso, altura, edad, sexo }) {
  const p = Number(peso), a = Number(altura), e = Number(edad)
  if (!p || !a || !e) return null
  return sexo === 'F' ? 10 * p + 6.25 * a - 5 * e - 161 : 10 * p + 6.25 * a - 5 * e + 5
}

export function calcularTDEE(perfil) {
  const bmr = calcularBMR(perfil)
  if (!bmr) return null
  const nivel = NIVELES_ACTIVIDAD.find((n) => n.id === perfil?.nivel_actividad) || NIVELES_ACTIVIDAD[2]
  return Math.round(bmr * nivel.factor)
}

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const hoy = new Date()
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00')
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const aunNoCumplio = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
  if (aunNoCumplio) edad -= 1
  return edad
}
