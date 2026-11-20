# Benutzerhandbuch – von Stammdaten zur Produktdefinition

[English](user-guide.en.md)

Stand: Entwicklungsversion. Beispiele sind illustrativ, keine Betriebsdaten. Die englischen DocType-Namen bleiben als Suchbegriffe erhalten.

1. **Voraussetzungen:** In ERPNext Unternehmen (Company), Lager (Warehouse), Mengeneinheit Gram und Nippey Print Settings prüfen. Für den bestehenden Eröffnungsbestand-Workflow muss permanente Inventur deaktiviert sein. Artikelvorlagen (Item) mit Varianten, Präfix FIL-, Lagereinheit Gram und Attributen Manufacturer und Colour müssen existieren.
2. **Hersteller/Farbe:** Item Attribute öffnen (Manufacturer bzw. Colour), Wert und eindeutiges Kürzel anlegen. Alternativ in der Rollenerfassung hinzufügen. HEX und RAL sind nicht im Attribut gespeichert, sondern pro Artikelvariante (Item): custom_display_color, custom_ral_code, custom_ral_accuracy, custom_manufacturer_color_name. Über Artikel/Farbe bearbeiten im Filamentlager korrigieren; betrifft alle Rollen der Variante.
3. **Filamentrolle:** QR-Etikett reservieren (/nippey-print-labels), Rolle erfassen (/nippey-print), Material, Hersteller, Farbe, Nenngewicht, Brutto, Tara und Preis eintragen. Das gegenwärtige Verfahren erzeugt Eröffnungsbestand, Artikelvariante bei Bedarf, Batch und Stock Entry. Nicht als Ersatz für regulären Wareneingang verwenden. Bestand im Filamentlager prüfen; Gewichtsabweichungen über Wiegekorrektur statt direkter Bestandsänderung buchen.
4. **Druckprodukt:** Print Product im Desk anlegen oder vorhandenes Preset verwenden. Parameter mit Schlüssel, Typ, Standardwert, Pflichtstatus und Geometrie-Relevanz definieren. Farbe ist normalerweise keine Geometrie.
5. **Konfiguration:** /nippey-print-products öffnen, Produkt und Werte auswählen, Konfiguration speichern. Eine Geometriesignatur erlaubt Wiederverwendung von Modellen für Varianten. 
6. **Gehäuserevision:** Modellrevision (Print Model Revision) für Konfiguration anlegen, interne Revision, Dateien und ggf. Vorgänger im Desk ergänzen. STL/3MF für Freigabe notwendig. Im Modellmanager Vorschau kontrollieren. Freigabe erst nach Prüfung.
7. **Komponente:** Print Component Type bestimmt Produkt, Codepräfix und geerbte Geometrieparameter. Leere Liste bedeutet gemeinsame Geometrie innerhalb des Produkts. Im Modellmanager Typ und Quellkonfiguration auswählen, Namensvorschlag prüfen (bei Bedarf ändern), lokale STL auswählen, interne Revision und optionale Hinweise eintragen und speichern. Passende vorhandene Komponente wird wiederverwendet; Dateien privat, Revision Draft.
8. **Kompatibilität:** Print Component Compatibility im Desk anlegen, konkrete Komponenten- und Modellrevision auswählen. Historische Hinweise sind keine Freigabe. Nach Prüfung Compatible setzen. Freigegebene Modelle sind unveränderlich; Änderungen als neue Revision erfassen.
9. **Fertigung:** Stücklisten, Materialzuordnung, Arbeitsgänge, Drucker, Fertigungsaufträge und Istkosten sind noch nicht vollständig integriert. Die Produktdefinition ist daher nicht gleichbedeutend mit einer fertig eingerichteten Produktion.

## Offene Punkte
Neuinstallation der Stammdaten aus völlig leerer Datenbank, besondere Namensvorlagen, Massenzuordnung, CAD-Automatisierung und vollständiger Fertigungsablauf sind noch nicht durchgehend getestet bzw. implementiert. Bei Korrekturen keine Signaturen oder Bestandsbuchungen direkt in der Datenbank ändern.
