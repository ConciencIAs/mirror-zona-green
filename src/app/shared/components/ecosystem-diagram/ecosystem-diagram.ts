import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';

interface EcosystemNode {
  title: string;
  quienes: string;
  rol: string;
  x: number;
  y: number;
  icon: 'territorio' | 'salud' | 'conocimiento' | 'operacion' | 'infraestructura';
}

@Component({
  selector: 'app-ecosystem-diagram',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ecosystem-diagram.html',
})
export class EcosystemDiagram {
  private readonly appConfigStore = inject(AppConfigStore);

  protected readonly logoUrl = computed(
    () => this.appConfigStore.settingsConfig()?.logo_url || '/images/logo-zona-green-blanco.svg',
  );

  protected readonly nodes: EcosystemNode[] = [
    {
      title: 'Gobernanza Territorial y Comunitaria',
      quienes: "Proyecto Nasa, MANTEY YU'CE TA'SX, autoridades indígenas y organizaciones comunitarias.",
      rol: 'Custodian legitimidad territorial, autonomía y visión del ecosistema.',
      x: 171,
      y: 122,
      icon: 'territorio',
    },
    {
      title: 'Salud y Acompañamiento',
      quienes: 'IPS, médicos, especialistas, sabedores ancestrales y asociaciones de pacientes.',
      rol: 'Orientación, acompañamiento y cuidado integral.',
      x: 429,
      y: 122,
      icon: 'salud',
    },
    {
      title: 'Conocimiento e Investigación',
      quienes: 'Universidades, investigadores, laboratorios y expertos en salud pública.',
      rol: 'Generación de evidencia, conocimiento y mejora continua.',
      x: 509,
      y: 368,
      icon: 'conocimiento',
    },
    {
      title: 'Operación Regulada',
      quienes: 'Farmacias, droguerías, cultivadores aliados y operadores autorizados.',
      rol: 'Acceso regulado, validación y dispensación trazable.',
      x: 300,
      y: 520,
      icon: 'operacion',
    },
    {
      title: 'Infraestructura Tecnológica',
      quienes: 'Tecnología, trazabilidad, compliance y protección de datos.',
      rol: 'Seguridad, transparencia y conexión entre actores.',
      x: 91,
      y: 368,
      icon: 'infraestructura',
    },
  ];

  protected readonly selected = signal<number | null>(null);

  protected readonly selectedNode = computed(() => {
    const i = this.selected();
    return i === null ? null : this.nodes[i];
  });

  select(i: number): void {
    this.selected.set(this.selected() === i ? null : i);
  }
}
