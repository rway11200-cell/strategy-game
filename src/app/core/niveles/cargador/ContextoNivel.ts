import { CreadorUnidades } from "../../CreadorUnidades";
import { BaseTorre } from "../../unidades/BaseTorre";
import { Enemigo } from "../../unidades/Enemigo";
import { Proyectil } from "../../unidades/Proyectil";
import { Torre } from "../../unidades/Torre";
import { EntityDef, PathDef } from "./SchemaNivel";

export class ContextoNivel {
  constructor(
    public paths: PathDef[],
    public entities: EntityDef[],
    public monedas: number = 100,
    public mostrarMensaje: (mensaje: string) => void,
    public creadorEnemigos: CreadorUnidades<Enemigo>,
    public creadorBaseTorres: CreadorUnidades<BaseTorre>,
    public creadorTorres: CreadorUnidades<Torre>,
    public creadorProyectiles: CreadorUnidades<Proyectil>,
  ) {}
}
