import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';

@Component({
  selector: 'app-faq',
  imports: [RouterLink, Accordion, AccordionPanel, AccordionHeader, AccordionContent],
  templateUrl: './faq.html',
})
export class Faq {}
