#!/usr/bin/env python3
"""
Genera 1000 recibos sintéticos de comercios mexicanos con ground truth.
Cada recibo incluye: texto OCR simulado, etiquetas por línea y datos reales.
"""

import json
import os
import random
import string
from datetime import datetime, timedelta

random.seed(42)

# ═══════════════════════════════════════════
# BASE DE DATOS DE COMERCIOS (120+)
# ═══════════════════════════════════════════

MERCHANTS = {
    'Comida': [
        {'name': 'OXXO', 'rfc': 'CCO8605231N4', 'legal': 'CADENA COMERCIAL OXXO S.A. DE C.V.'},
        {'name': 'Walmart', 'rfc': 'NWM9709244W4', 'legal': 'NUEVA WAL MART DE MEXICO S.A. DE C.V.'},
        {'name': 'Starbucks', 'rfc': 'OAB160317A37', 'legal': 'OPERADORA DE ALIMENTOS Y BEBIDAS STARBUCKS S DE RL DE CV'},
        {'name': "McDonald's", 'rfc': 'ASF940622GE5', 'legal': 'ARCOS DORADOS S.A. DE C.V.'},
        {'name': 'Burger King', 'rfc': 'BKM960701HH4', 'legal': 'BURGER KING DE MEXICO S.A. DE C.V.'},
        {'name': 'Subway', 'rfc': 'SMS050211QR7', 'legal': 'SUBWAY MEXICO SUBS S.A. DE C.V.'},
        {'name': "Domino's Pizza", 'rfc': 'DAL920305FG6', 'legal': 'DOMINOS ALSEA S.A. DE C.V.'},
        {'name': 'Little Caesars', 'rfc': 'LCM030815JK2', 'legal': 'LITTLE CAESARS MEXICO S.A. DE C.V.'},
        {'name': 'KFC', 'rfc': 'KFC010203AB4', 'legal': 'KFC DE MEXICO S.A. DE C.V.'},
        {'name': 'Pollo Loco', 'rfc': 'EPL870922QW3', 'legal': 'EL POLLO LOCO S.A. DE C.V.'},
        {'name': 'VIPS', 'rfc': 'ALS931130BA8', 'legal': 'ALSEA S.A.B. DE C.V.'},
        {'name': 'Sanborns', 'rfc': 'SAN860305MN2', 'legal': 'SANBORNS HERMANOS S.A. DE C.V.'},
        {'name': 'Toks', 'rfc': 'TOK910620HG5', 'legal': 'RESTAURANTES TOKS S.A. DE C.V.'},
        {'name': "Italiannis", 'rfc': 'ITA950815JK7', 'legal': 'ITALIANNIS RESTAURANT S.A. DE C.V.'},
        {'name': "Applebee's", 'rfc': 'APP870315LM4', 'legal': "APPLEBEE'S MEXICO S.A. DE C.V."},
        {'name': "Chili's", 'rfc': 'CHI920620QR8', 'legal': "CHILI'S MEXICO S.A. DE C.V."},
        {'name': "Carl's Jr", 'rfc': 'CJM850115AB6', 'legal': "CARL'S JR MEXICO S.A. DE C.V."},
        {'name': 'La Casa de Toño', 'rfc': 'LCT010530PQ2', 'legal': 'LA CASA DE TONO S.A. DE C.V.'},
        {'name': 'El Fogón', 'rfc': 'FOG980715CD3', 'legal': 'EL FOGON RESTAURANTE S.A. DE C.V.'},
        {'name': 'El Portón', 'rfc': 'POR010830MN9', 'legal': 'EL PORTON RESTAURANTE S.A. DE C.V.'},
        {'name': 'Wings', 'rfc': 'WIN050315GH4', 'legal': 'WINGS ARMY S.A. DE C.V.'},
        {'name': 'Soriana', 'rfc': 'OMS960101QR3', 'legal': 'ORGANIZACION SORIANA S.A.B. DE C.V.'},
        {'name': 'Chedraui', 'rfc': 'GCH920310AB5', 'legal': 'GRUPO COMERCIAL CHEDRAUI S.A.B. DE C.V.'},
        {'name': 'HEB', 'rfc': 'HEB840701CD8', 'legal': 'HEB MEXICO S. DE R.L. DE C.V.'},
        {'name': 'La Comer', 'rfc': 'LCO980615MN4', 'legal': 'LA COMER S.A.B. DE C.V.'},
        {'name': 'Bodega Aurrera', 'rfc': 'NWM9709244W4', 'legal': 'NUEVA WAL MART DE MEXICO S.A. DE C.V.'},
        {'name': 'Costco', 'rfc': 'COS920301AB7', 'legal': 'COSTCO DE MEXICO S.A. DE C.V.'},
        {"name": "Sam's Club", 'rfc': 'NWM9709244W4', 'legal': 'NUEVA WAL MART DE MEXICO S.A. DE C.V.'},
        {'name': '7-Eleven', 'rfc': 'SEM680801QR2', 'legal': '7-ELEVEN MEXICO S.A. DE C.V.'},
        {'name': 'Circle K', 'rfc': 'CIR980315CD5', 'legal': 'CIRCLE K MEXICO S.A. DE C.V.'},
        {'name': 'Taquería Los Compadres', 'rfc': 'TLC010203XY9', 'legal': 'TAQUERIA LOS COMPADRES S.A. DE C.V.'},
        {'name': 'Fonda Doña Mary', 'rfc': 'FDM850620AB3', 'legal': 'FONDA DONA MARY'},
        {'name': 'El Péndulo', 'rfc': 'CEP920115AB3', 'legal': 'CAFETERIA EL PENDULO S.A. DE C.V.'},
        {'name': 'Cielito Querido Café', 'rfc': 'CQC100215MN8', 'legal': 'CIELITO QUERIDO CAFE S.A. DE C.V.'},
        {'name': 'Punta del Cielo', 'rfc': 'PDC050830GH2', 'legal': 'PUNTA DEL CIELO S.A. DE C.V.'},
        {'name': 'Sushi Itto', 'rfc': 'SIT920715JK4', 'legal': 'SUSHI ITTO S.A. DE C.V.'},
        {'name': 'Superama', 'rfc': 'NWM9709244W4', 'legal': 'NUEVA WAL MART DE MEXICO S.A. DE C.V.'},
        {'name': 'City Market', 'rfc': 'LCO980615MN4', 'legal': 'LA COMER S.A.B. DE C.V.'},
        {'name': 'Hooters', 'rfc': 'HOO000315AB6', 'legal': 'HOOTERS DE MEXICO S.A. DE C.V.'},
        {'name': 'Bisquets Obregón', 'rfc': 'BOB780920CD9', 'legal': 'BISQUETS OBREGON S.A. DE C.V.'},
    ],
    'Transporte': [
        {'name': 'PEMEX', 'rfc': 'GVA980701QR5', 'legal': 'GASOLINERA DEL VALLE S.A. DE C.V.'},
        {'name': 'Shell', 'rfc': 'SME900115AB4', 'legal': 'SHELL MEXICO S.A. DE C.V.'},
        {'name': 'Oxxo Gas', 'rfc': 'CCO8605231N4', 'legal': 'CADENA COMERCIAL OXXO S.A. DE C.V.'},
        {'name': 'BP', 'rfc': 'BPM010630JK7', 'legal': 'BP MEXICO S.A. DE C.V.'},
        {'name': 'Mobil', 'rfc': 'EME780315MN2', 'legal': 'EXXON MOBIL MEXICO S.A. DE C.V.'},
        {'name': 'Gulf', 'rfc': 'GUL050920CD8', 'legal': 'GULF MEXICO S.A. DE C.V.'},
        {'name': 'Uber', 'rfc': 'UBE130301AB5', 'legal': 'UBER MEXICO TECHNOLOGY & SOFTWARE S.A. DE C.V.'},
        {'name': 'DiDi', 'rfc': 'DDM180501MN3', 'legal': 'DIDI MEXICO TECHNOLOGY S.A. DE C.V.'},
        {'name': 'Cabify', 'rfc': 'CAB150801GH6', 'legal': 'CABIFY MEXICO S.A.P.I. DE C.V.'},
        {'name': 'Beat', 'rfc': 'BEA170301QR9', 'legal': 'BEAT RIDE SERVICES MEXICO S.A. DE C.V.'},
        {'name': 'InDriver', 'rfc': 'IND190601AB2', 'legal': 'INDRIVER MEXICO S.A. DE C.V.'},
        {'name': 'ADO', 'rfc': 'ADO720115CD4', 'legal': 'AUTOBUSES DE ORIENTE S.A. DE C.V.'},
        {'name': 'Primera Plus', 'rfc': 'FLE740301MN6', 'legal': 'FLECHA AMARILLA PLUS S.A. DE C.V.'},
        {'name': 'ETN', 'rfc': 'TUR810620JK8', 'legal': 'TURISTAR LUJO S.A. DE C.V.'},
        {'name': 'Estrella Blanca', 'rfc': 'EBL630115AB3', 'legal': 'ESTRELLA BLANCA S.A. DE C.V.'},
        {'name': 'Volaris', 'rfc': 'VOL060301GH5', 'legal': 'CONCESIONARIA VUELA COMPANIA DE AVIACION S.A. DE C.V.'},
        {'name': 'Aeromexico', 'rfc': 'AER880401QR7', 'legal': 'AEROVIAS DE MEXICO S.A. DE C.V.'},
        {'name': 'VivaAerobus', 'rfc': 'AVI061201CD9', 'legal': 'AEROENLACES NACIONALES S.A. DE C.V.'},
        {'name': 'AutoZone', 'rfc': 'AZM980915MN5', 'legal': 'AUTOZONE DE MEXICO S.A. DE C.V.'},
        {'name': 'Verificentro', 'rfc': 'VER950301AB8', 'legal': 'VERIFICENTRO AMBIENTAL S.A. DE C.V.'},
    ],
    'Entretenimiento': [
        {'name': 'Cinépolis', 'rfc': 'CIN710401JK3', 'legal': 'CINEPOLIS DE MEXICO S.A. DE C.V.'},
        {'name': 'Cinemex', 'rfc': 'CME950801MN7', 'legal': 'CADENA MEXICANA DE EXHIBICION S.A. DE C.V.'},
        {'name': 'Sport City', 'rfc': 'SPC850301GH9', 'legal': 'SPORT CITY S.A. DE C.V.'},
        {'name': 'Smart Fit', 'rfc': 'SMF150601AB2', 'legal': 'SMART FIT MEXICO S.A. DE C.V.'},
        {'name': 'Six Flags', 'rfc': 'SIX990815CD6', 'legal': 'SIX FLAGS MEXICO S.A. DE C.V.'},
        {'name': 'Ticketmaster', 'rfc': 'TIM000301QR4', 'legal': 'TICKETMASTER DE MEXICO S.A. DE C.V.'},
        {'name': 'Mixup', 'rfc': 'MIX920401MN8', 'legal': 'MIXUP S.A. DE C.V.'},
        {'name': 'Bar La Cervecería', 'rfc': 'BLC100920AB5', 'legal': 'BAR LA CERVECERIA DE BARRIO S.A. DE C.V.'},
        {'name': 'Salón Corona', 'rfc': 'SCO500620JK7', 'legal': 'SALON CORONA S.A. DE C.V.'},
        {'name': 'Recinto Ferial', 'rfc': 'RFE850115CD3', 'legal': 'RECINTO FERIAL S.A. DE C.V.'},
        {'name': 'Laser Tag Arena', 'rfc': 'LTA120301GH9', 'legal': 'LASER TAG ARENA MEXICO S.A. DE C.V.'},
        {'name': 'Boliche Bol', 'rfc': 'BOL970601MN2', 'legal': 'BOLICHE BOL S.A. DE C.V.'},
        {'name': 'Estadio Azteca', 'rfc': 'EAZ660301QR6', 'legal': 'ESTADIO AZTECA S.A. DE C.V.'},
        {'name': 'Mundo E', 'rfc': 'MUE100801AB4', 'legal': 'MUNDO E ENTRETENIMIENTO S.A. DE C.V.'},
        {'name': 'KidZania', 'rfc': 'KDZ990401CD8', 'legal': 'KIDZANIA DE MEXICO S.A. DE C.V.'},
    ],
    'Salud': [
        {'name': 'Farmacia Guadalajara', 'rfc': 'FGU830930PD2', 'legal': 'FARMACIA GUADALAJARA S.A. DE C.V.'},
        {'name': 'Farmacias del Ahorro', 'rfc': 'NFA920101AB6', 'legal': 'NUEVA FARMACIAS DEL AHORRO S.A. DE C.V.'},
        {'name': 'Farmacias Similares', 'rfc': 'FSI970301CD9', 'legal': 'FARMACIAS DE SIMILARES S.A. DE C.V.'},
        {'name': 'Farmacia San Pablo', 'rfc': 'FSP880601MN3', 'legal': 'FARMACIA SAN PABLO S.A. DE C.V.'},
        {'name': 'Benavides', 'rfc': 'FBE710401JK5', 'legal': 'FARMACIAS BENAVIDES S.A.B. DE C.V.'},
        {'name': 'Salud Digna', 'rfc': 'SDI110301GH7', 'legal': 'SALUD DIGNA I.A.P.'},
        {'name': 'Laboratorios Chopo', 'rfc': 'LCH800601QR2', 'legal': 'LABORATORIOS CHOPO S.A. DE C.V.'},
        {'name': 'Hospital Angeles', 'rfc': 'HAN850301AB4', 'legal': 'HOSPITAL ANGELES S.A. DE C.V.'},
        {'name': 'Hospital Star Medica', 'rfc': 'HSM950601CD8', 'legal': 'HOSPITAL STAR MEDICA S.A. DE C.V.'},
        {'name': 'Ópticas Lux', 'rfc': 'OLX720301MN6', 'legal': 'OPTICAS LUX S.A. DE C.V.'},
        {'name': 'Consultorio Dr. García', 'rfc': 'GAGM750515AB3', 'legal': 'GARCIA GARCIA MARIO'},
        {'name': 'Dentista Dr. López', 'rfc': 'LORM820620CD7', 'legal': 'LOPEZ RODRIGUEZ MARIA'},
        {'name': 'Nutrisa', 'rfc': 'NUT900301GH5', 'legal': 'NUTRISA S.A. DE C.V.'},
        {'name': 'GNC', 'rfc': 'GNC010601QR9', 'legal': 'GNC DE MEXICO S.A. DE C.V.'},
        {'name': 'Clínica Dental Sonrisa', 'rfc': 'CDS080301AB2', 'legal': 'CLINICA DENTAL SONRISA S.A. DE C.V.'},
    ],
    'Educacion': [
        {'name': 'Gandhi', 'rfc': 'LGA010301CD4', 'legal': 'LIBRERIAS GANDHI S.A. DE C.V.'},
        {'name': 'El Sótano', 'rfc': 'LSO750601MN8', 'legal': 'LIBRERIA EL SOTANO S.A. DE C.V.'},
        {'name': 'Papelería Lumen', 'rfc': 'PLU920301GH6', 'legal': 'PAPELERIA LUMEN S.A. DE C.V.'},
        {'name': 'Office Depot', 'rfc': 'ODM950801QR3', 'legal': 'OFFICE DEPOT DE MEXICO S.A. DE C.V.'},
        {'name': 'OfficeMax', 'rfc': 'OMX960301AB5', 'legal': 'OFFICEMAX DE MEXICO S.A. DE C.V.'},
        {'name': 'Sanborns Libros', 'rfc': 'SAN860305MN2', 'legal': 'SANBORNS HERMANOS S.A. DE C.V.'},
        {'name': 'UNAM Tienda', 'rfc': 'UNA290122AB4', 'legal': 'UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO'},
        {'name': 'Tec de Monterrey', 'rfc': 'ITE430714CD8', 'legal': 'INSTITUTO TECNOLOGICO Y DE ESTUDIOS SUPERIORES DE MONTERREY'},
        {'name': 'Papelería El Iris', 'rfc': 'PIR780301MN6', 'legal': 'PAPELERIA EL IRIS S.A. DE C.V.'},
        {'name': 'Lumen Libros', 'rfc': 'LLI850601GH2', 'legal': 'LUMEN LIBROS S.A. DE C.V.'},
    ],
    'Otros': [
        {'name': 'Liverpool', 'rfc': 'ELI780915AB7', 'legal': 'EL PUERTO DE LIVERPOOL S.A.B. DE C.V.'},
        {'name': 'Palacio de Hierro', 'rfc': 'EPH840301CD3', 'legal': 'EL PALACIO DE HIERRO S.A. DE C.V.'},
        {'name': 'Sears', 'rfc': 'SRE570101MN9', 'legal': 'SEARS ROEBUCK DE MEXICO S.A. DE C.V.'},
        {'name': 'Coppel', 'rfc': 'COP920301GH5', 'legal': 'COPPEL S.A. DE C.V.'},
        {'name': 'Elektra', 'rfc': 'ELE900301QR8', 'legal': 'GRUPO ELEKTRA S.A.B. DE C.V.'},
        {'name': 'Home Depot', 'rfc': 'HDM001017AB2', 'legal': 'HOME DEPOT MEXICO S. DE R.L. DE C.V.'},
        {'name': 'Tintorería Francesa', 'rfc': 'TFR010530CD6', 'legal': 'TINTORERIA FRANCESA S.A. DE C.V.'},
        {'name': 'Telcel', 'rfc': 'RMO840315MN4', 'legal': 'RADIOMOVIL DIPSA S.A. DE C.V.'},
        {'name': 'Telmex', 'rfc': 'TME840315GH8', 'legal': 'TELEFONOS DE MEXICO S.A.B. DE C.V.'},
        {'name': 'CFE', 'rfc': 'CFE370814QR2', 'legal': 'COMISION FEDERAL DE ELECTRICIDAD'},
        {'name': 'Miniso', 'rfc': 'MIN170301AB5', 'legal': 'MINISO MEXICO S.A. DE C.V.'},
        {'name': 'Zara', 'rfc': 'ZAR920601CD9', 'legal': 'ZARA MEXICO S.A. DE C.V.'},
        {'name': 'H&M', 'rfc': 'HNM120301MN3', 'legal': 'H AND M HENNES AND MAURITZ S.A. DE C.V.'},
        {'name': 'Mueblería Standard', 'rfc': 'MST890601GH7', 'legal': 'MUEBLERIA STANDARD S.A. DE C.V.'},
        {'name': 'Peluquería Estilo', 'rfc': 'PES050301QR4', 'legal': 'PELUQUERIA ESTILO S.A. DE C.V.'},
        {'name': 'Lavandería Express', 'rfc': 'LEX100601AB8', 'legal': 'LAVANDERIA EXPRESS S.A. DE C.V.'},
        {'name': 'Ferretería El Tornillo', 'rfc': 'FET780301CD2', 'legal': 'FERRETERIA EL TORNILLO S.A. DE C.V.'},
        {'name': 'Estética Belleza', 'rfc': 'EBE000601MN6', 'legal': 'ESTETICA BELLEZA S.A. DE C.V.'},
        {'name': 'Pet Smart', 'rfc': 'PSM100301GH4', 'legal': 'PETSMART DE MEXICO S.A. DE C.V.'},
        {'name': 'Petco', 'rfc': 'PET120601QR8', 'legal': 'PETCO MEXICO S.A. DE C.V.'},
    ],
}

# ═══════════════════════════════════════════
# BASE DE DATOS DE PRODUCTOS (300+)
# ═══════════════════════════════════════════

PRODUCTS = {
    'Comida': [
        ('Coca Cola 600ml', 18, 25), ('Pepsi 600ml', 16, 22), ('Agua Ciel 1L', 12, 18),
        ('Sabritas Sal 45g', 14, 20), ('Doritos Nacho 62g', 18, 25), ('Ruffles Queso 50g', 16, 22),
        ('Gansito Marinela', 12, 18), ('Chocoroles', 10, 15), ('Submarinos', 10, 15),
        ('Bimbo Pan Blanco', 35, 50), ('Pan Bimbo Grande', 38, 52), ('Tortillas 1kg', 18, 25),
        ('Leche Lala 1L', 28, 45), ('Leche Alpura 1L', 30, 48), ('Yogurt Activia', 15, 25),
        ('Huevo Bach 12pz', 45, 65), ('Huevo San Juan 12pz', 40, 60),
        ('Arroz 1kg', 22, 35), ('Frijol 1kg', 25, 40), ('Azucar 1kg', 28, 38),
        ('Aceite 1L', 35, 55), ('Aceite Oliva 500ml', 80, 150),
        ('Café Americano', 35, 65), ('Cappuccino', 55, 95), ('Latte', 60, 100),
        ('Caramel Macchiato', 75, 110), ('Frappuccino', 85, 120), ('Espresso', 30, 50),
        ('Croissant', 35, 65), ('Muffin Choco', 40, 60), ('Bagel', 35, 55),
        ('Hamburguesa Clásica', 65, 120), ('Hamburguesa Doble', 95, 150),
        ('Big Mac', 79, 99), ('Whopper', 85, 110), ('McNuggets 10pz', 89, 119),
        ('Pizza Grande', 149, 250), ('Pizza Mediana', 99, 179),
        ('Tacos Pastor x3', 36, 60), ('Tacos Bistec x3', 45, 75), ('Tacos Suadero x3', 36, 60),
        ('Quesadilla', 25, 45), ('Gordita', 20, 40), ('Tlayuda', 80, 140),
        ('Pozole', 70, 120), ('Enchiladas', 65, 110), ('Chilaquiles', 55, 95),
        ('Torta Milanesa', 55, 85), ('Agua Horchata', 20, 35), ('Agua Jamaica', 20, 35),
        ('Refresco 2L', 28, 40), ('Jugo Del Valle 1L', 25, 38),
        ('Salsa Extra', 5, 15), ('Guacamole', 25, 50),
        ('Sushi Roll 8pz', 89, 160), ('Ramen', 110, 180),
        ('Cereal Zucaritas', 55, 80), ('Galletas Marías', 15, 25),
        ('Detergente 1L', 45, 75), ('Jabón Zote', 18, 28),
        ('Papel Higienico 4r', 35, 55), ('Papel Higienico 48r', 250, 350),
        ('TV Samsung 55"', 8999, 15999), ('Laptop HP', 12999, 22999),
    ],
    'Transporte': [
        ('Gasolina Magna', 400, 1200), ('Gasolina Premium', 500, 1500),
        ('Diesel', 350, 1000), ('Aceite Motor', 120, 250),
        ('Viaje Uber', 45, 350), ('Viaje DiDi', 40, 300),
        ('Viaje Cabify', 55, 400), ('Viaje Beat', 35, 250),
        ('Boleto ADO', 200, 800), ('Boleto Primera Plus', 250, 900),
        ('Boleto ETN', 300, 1200), ('Boleto Estrella Blanca', 180, 700),
        ('Vuelo Volaris', 800, 4500), ('Vuelo Aeromexico', 1200, 8000),
        ('Vuelo VivaAerobus', 600, 3500),
        ('Verificación vehicular', 450, 650), ('Afinación motor', 800, 2500),
        ('Cambio aceite', 350, 800), ('Llanta nueva', 800, 3000),
        ('Refacción frenos', 500, 2000), ('Batería auto', 1200, 3500),
        ('Caseta peaje', 30, 250), ('Estacionamiento', 20, 150),
    ],
    'Entretenimiento': [
        ('Boleto Cine', 65, 120), ('Combo Palomitas', 95, 180),
        ('Palomitas Grandes', 75, 130), ('Refresco Cine', 55, 85),
        ('Hot Dog Cine', 55, 85), ('Nachos Cine', 75, 110),
        ('Membresía Gimnasio', 499, 1200), ('Clase Yoga', 100, 250),
        ('Clase Spinning', 100, 250), ('Entrada Museo', 50, 200),
        ('Concierto VIP', 800, 5000), ('Concierto General', 350, 1500),
        ('Boleto Six Flags', 550, 800), ('Boleto KidZania', 350, 600),
        ('Cerveza', 45, 120), ('Cocktail', 80, 200),
        ('Mezcal', 80, 250), ('Tequila', 60, 180),
        ('Boliche partida', 60, 150), ('Laser Tag', 100, 200),
    ],
    'Salud': [
        ('Paracetamol 500mg', 25, 65), ('Ibuprofeno 400mg', 30, 70),
        ('Vitamina C 1000mg', 55, 120), ('Vitamina D', 80, 180),
        ('Suero Oral', 25, 45), ('Antigripal', 65, 130),
        ('Antibiótico', 120, 350), ('Antialérgico', 45, 120),
        ('Consulta Médica', 300, 800), ('Consulta Dental', 250, 600),
        ('Limpieza Dental', 400, 1000), ('Consulta Oftalmólogo', 350, 900),
        ('Análisis Sangre', 200, 600), ('Análisis Orina', 100, 300),
        ('Radiografía', 250, 800), ('Ultrasonido', 500, 1500),
        ('Lentes Graduados', 800, 3500), ('Lentes Contacto', 300, 1200),
        ('Crema Facial', 120, 350), ('Protector Solar', 150, 400),
        ('Curitas', 25, 55), ('Alcohol Gel', 35, 80),
    ],
    'Educacion': [
        ('Libro texto', 150, 500), ('Novela', 180, 400),
        ('Cuaderno 100h', 25, 55), ('Cuaderno Prof 200h', 45, 85),
        ('Pluma BIC 10pz', 35, 60), ('Lápiz Mongol 12pz', 25, 45),
        ('Colores Prismacolor', 120, 350), ('Marcadores 12pz', 80, 200),
        ('Mochila escolar', 350, 800), ('Calculadora científica', 250, 550),
        ('Cartulina 10pz', 30, 60), ('Hojas blancas 500', 80, 150),
        ('Curso online', 200, 2500), ('Certificación', 500, 5000),
        ('Impresión tesis', 200, 600), ('Encuadernación', 50, 200),
        ('USB 32GB', 120, 250), ('Diccionario', 150, 350),
    ],
    'Otros': [
        ('Camisa', 350, 900), ('Pantalón', 400, 1200),
        ('Zapatos', 600, 2500), ('Vestido', 500, 2000),
        ('Herramienta', 80, 500), ('Pintura 4L', 250, 600),
        ('Foco LED', 35, 120), ('Cable USB', 50, 200),
        ('Servicio tintorería', 80, 250), ('Lavado auto', 60, 200),
        ('Corte cabello', 80, 250), ('Tinte cabello', 200, 600),
        ('Comida mascota 4kg', 180, 450), ('Arena gato 10kg', 150, 300),
        ('Detergente 5kg', 150, 280), ('Suavizante 2L', 55, 120),
        ('Toallas', 80, 250), ('Sábanas', 300, 800),
        ('Plan celular', 200, 600), ('Recibo luz', 150, 800),
        ('Recibo agua', 50, 300), ('Internet mensual', 350, 800),
    ],
}

# ═══════════════════════════════════════════
# DIRECCIONES Y LOCACIONES MEXICANAS
# ═══════════════════════════════════════════

STREETS = [
    'AV REFORMA', 'AV INSURGENTES', 'BLVD ADOLFO LOPEZ MATEOS', 'CALLE SONORA',
    'AV UNIVERSIDAD', 'AV CHAPULTEPEC', 'BLVD MANUEL AVILA CAMACHO', 'CALLE DURANGO',
    'AV REVOLUCION', 'AV DIVISION DEL NORTE', 'AV NUEVO LEON', 'PASEO DE LA REFORMA',
    'CALLE MONTERREY', 'AV CUAUHTEMOC', 'BLVD MAGNOCENTRO', 'AV VALLARTA',
    'CALLE 5 DE MAYO', 'AV JUAREZ', 'CALLE MADERO', 'AV HIDALGO',
]

COLONIAS = [
    'COL JUAREZ', 'COL ROMA', 'COL CONDESA', 'COL POLANCO', 'COL DEL VALLE',
    'COL NARVARTE', 'COL NAPOLES', 'COL SANTA FE', 'COL COYOACAN', 'COL TLALPAN',
    'COL CENTRO', 'COL TABACALERA', 'COL ANZURES', 'COL ESCANDÓN', 'COL MIXCOAC',
]

CITIES = [
    'MEXICO D.F.', 'CDMX', 'GUADALAJARA JAL', 'MONTERREY NL',
    'PUEBLA PUE', 'QUERETARO QRO', 'MERIDA YUC', 'CANCUN QR',
    'LEON GTO', 'TIJUANA BC',
]

# ═══════════════════════════════════════════
# PLANTILLAS DE TICKETS (10 formatos)
# ═══════════════════════════════════════════

def format_price(value, with_dollar=True, with_comma=False):
    if with_comma and value >= 1000:
        int_part = int(value)
        dec_part = value - int_part
        formatted = f'{int_part:,}.{int(dec_part*100):02d}'
    else:
        formatted = f'{value:.2f}'
    return f'${formatted}' if with_dollar else formatted


def random_date():
    start = datetime(2023, 1, 1)
    end = datetime(2024, 12, 31)
    delta = end - start
    d = start + timedelta(days=random.randint(0, delta.days))
    return d


def format_date_style(d, style):
    months_es = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    months_short = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                    'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

    if style == 'iso':
        return d.strftime('%Y-%m-%d')
    elif style == 'dmy_slash':
        return d.strftime('%d/%m/%Y')
    elif style == 'dmy_dash':
        return d.strftime('%d-%m-%Y')
    elif style == 'dmy_short':
        return f'{d.day:02d}/{months_short[d.month-1]}/{d.year}'
    elif style == 'dmy_dash_short':
        return f'{d.day:02d}-{months_short[d.month-1]}-{d.year}'
    elif style == 'text_full':
        return f'{d.day} de {months_es[d.month-1]} de {d.year}'
    elif style == 'text_no_year':
        return f'{d.day} de {months_es[d.month-1]}'
    else:
        return d.strftime('%d/%m/%Y')


def random_time():
    return f'{random.randint(6,23):02d}:{random.randint(0,59):02d}'


def random_address():
    street = random.choice(STREETS)
    num = random.randint(100, 9999)
    col = random.choice(COLONIAS)
    city = random.choice(CITIES)
    cp = random.randint(1000, 99999)
    return street, num, col, city, cp


def generate_products(category, count=None):
    if count is None:
        count = random.randint(1, 6)
    pool = PRODUCTS.get(category, PRODUCTS['Otros'])
    items = random.sample(pool, min(count, len(pool)))
    result = []
    for name, lo, hi in items:
        price = round(random.uniform(lo, hi), 2)
        # Truncate to 2 decimals
        price = round(price, 2)
        qty = 1
        if random.random() < 0.2:
            qty = random.randint(2, 5)
        result.append({'name': name, 'price': price, 'qty': qty})
    return result


LINE_TYPES = [
    'MERCHANT', 'ADDRESS', 'RFC_LINE', 'DATE', 'PRODUCT',
    'SUBTOTAL', 'TAX', 'TOTAL', 'PAYMENT', 'CHANGE',
    'DECORATION', 'NOISE'
]


def build_receipt(template, merchant, category):
    """Build a receipt using the given template and merchant data."""
    date = random_date()
    date_style = random.choice(['iso', 'dmy_slash', 'dmy_dash', 'dmy_short', 'dmy_dash_short', 'text_full', 'text_no_year'])
    date_str = format_date_style(date, date_style)
    ground_truth_date = date.strftime('%Y-%m-%d')
    time_str = random_time()
    street, num, col, city, cp = random_address()
    products = generate_products(category)

    subtotal = sum(p['price'] * p['qty'] for p in products)
    subtotal = round(subtotal, 2)
    has_tax = random.random() < 0.7
    tax = round(subtotal * 0.16, 2) if has_tax else 0
    total = round(subtotal + tax, 2)

    lines = []  # list of (text, type)

    if template == 'oxxo':
        lines.append(('*' * 40, 'DECORATION'))
        lines.append((merchant['legal'], 'MERCHANT'))
        lines.append((f"RFC: {merchant['rfc']}", 'RFC_LINE'))
        suc = random.randint(1000, 99999)
        lines.append((f'TIENDA {suc} - SUC {random.choice(["REFORMA", "CENTRO", "NORTE", "SUR", "PONIENTE"])}', 'NOISE'))
        lines.append((f'{street} {num} {col}', 'ADDRESS'))
        lines.append((f'{city} C.P. {cp:05d}', 'ADDRESS'))
        lines.append((f'TEL ({random.randint(33,81):02d}) {random.randint(1000,9999)}-{random.randint(1000,9999)}', 'NOISE'))
        lines.append(('*' * 40, 'DECORATION'))
        lines.append((f'FECHA: {date_str}  HORA: {time_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            if p['qty'] > 1:
                lines.append((f"{p['qty']} x {p['name']}  {format_price(p['price'] * p['qty'])}", 'PRODUCT'))
            else:
                lines.append((f"{p['name']}  {format_price(p['price'])}", 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'SUBTOTAL  {format_price(subtotal)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'IVA  {format_price(tax)}', 'TAX'))
        lines.append((f'TOTAL  {format_price(total)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        payment = random.choice(['EFECTIVO', 'TARJETA VISA', 'TARJETA DEBITO', 'TC MASTERCARD'])
        if payment == 'EFECTIVO':
            paid = round(total + random.randint(1, 50) * 10, 2)
            lines.append((f'EFECTIVO  {format_price(paid)}', 'PAYMENT'))
            lines.append((f'CAMBIO  {format_price(round(paid - total, 2))}', 'CHANGE'))
        else:
            lines.append((f'{payment}  ****{random.randint(1000,9999)}', 'PAYMENT'))
            lines.append(('APROBADO', 'NOISE'))
        lines.append(('', 'NOISE'))
        lines.append(('GRACIAS POR SU COMPRA', 'NOISE'))

    elif template == 'walmart':
        lines.append(('=' * 35, 'DECORATION'))
        lines.append((f'=== {merchant["legal"].split(" S.")[0]} ===', 'MERCHANT'))
        lines.append(('S.A. DE C.V.', 'NOISE'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        store_type = random.choice(['SUPERCENTER', 'EXPRESS', 'NEIGHBORHOOD'])
        lines.append((f'{merchant["name"].upper()} {store_type} #{random.randint(1000,9999)}', 'NOISE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append((f'{date_str} {time_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            pname = p['name'].upper()
            ptotal = p['price'] * p['qty']
            lines.append((f'{pname}  {format_price(ptotal, False)}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'SUBTOTAL  {format_price(subtotal, False)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'IVA 16%  {format_price(tax, False)}', 'TAX'))
        lines.append(('', 'NOISE'))
        lines.append((f'TOTAL A PAGAR  {format_price(total)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        payment = random.choice(['TARJETA VISA', 'TARJETA DEBITO', 'TC MASTERCARD', 'EFECTIVO'])
        if payment == 'EFECTIVO':
            paid = round(total + random.randint(1, 20) * 50, 2)
            lines.append((f'EFECTIVO  {format_price(paid)}', 'PAYMENT'))
            lines.append((f'CAMBIO  {format_price(round(paid - total, 2))}', 'CHANGE'))
        else:
            lines.append((f'{payment}  ****{random.randint(1000,9999)}', 'PAYMENT'))
            lines.append(('APROBADO', 'NOISE'))
        lines.append(('', 'NOISE'))
        lines.append(('GRACIAS POR SU PREFERENCIA', 'NOISE'))

    elif template == 'restaurant':
        lines.append((merchant['name'].upper(), 'MERCHANT'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append((f'{col} {city}', 'ADDRESS'))
        lines.append(('', 'NOISE'))
        for p in products:
            ptotal = p['price'] * p['qty']
            if p['qty'] > 1:
                lines.append((f"{p['qty']} x {p['name']}  {format_price(ptotal)}", 'PRODUCT'))
            else:
                lines.append((f"{p['name']}  {format_price(p['price'])}", 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'Subtotal  {format_price(subtotal)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'IVA 16%  {format_price(tax)}', 'TAX'))
        lines.append((f'Total  {format_price(total)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        tip = round(total * 0.15, 2)
        lines.append((f'Propina sugerida 15%: {format_price(tip)}', 'NOISE'))
        lines.append((f'FECHA: {date_str}', 'DATE'))

    elif template == 'gas_station':
        lines.append((merchant['legal'], 'MERCHANT'))
        lines.append((f'EST. SERV. NO. {random.randint(1000,9999)}', 'NOISE'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append((f'{city} {cp:05d}', 'ADDRESS'))
        lines.append(('', 'NOISE'))
        lines.append((f'FECHA {format_date_style(date, "iso")} {time_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        bomba = random.randint(1, 12)
        litros = round(random.uniform(10, 60), 3)
        precio_l = round(random.uniform(20, 25), 2)
        producto = random.choice(['MAGNA', 'PREMIUM', 'DIESEL'])
        total = round(litros * precio_l, 2)
        subtotal = total
        lines.append((f'BOMBA: {bomba:02d} LITROS: {litros:.3f}', 'NOISE'))
        lines.append((f'PRODUCTO: {producto}', 'PRODUCT'))
        lines.append((f'PRECIO/L: {format_price(precio_l)}', 'NOISE'))
        lines.append(('', 'NOISE'))
        lines.append((f'IMPORTE:  {format_price(total)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        payment = random.choice(['EFECTIVO', 'TARJETA'])
        lines.append((f'FORMA DE PAGO: {payment}', 'PAYMENT'))

    elif template == 'coffee_shop':
        lines.append((merchant['name'].upper(), 'MERCHANT'))
        if random.random() < 0.5:
            lines.append((merchant['legal'], 'NOISE'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append(('', 'NOISE'))
        lines.append((f'Fecha: {date_str} {time_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            lines.append((f'1 {p["name"]}  {format_price(p["price"], False)}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'  Subtotal  {format_price(subtotal, False)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'  IVA 16%  {format_price(tax, False)}', 'TAX'))
        lines.append((f'  Total  {format_price(total, False)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        lines.append((f'TARJETA DEBITO', 'PAYMENT'))
        lines.append((f'****{random.randint(1000,9999)}', 'NOISE'))
        lines.append(('APROBADO', 'NOISE'))

    elif template == 'pharmacy':
        lines.append((merchant['name'].upper(), 'MERCHANT'))
        lines.append((merchant['legal'], 'NOISE'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        suc = random.randint(100, 9999)
        lines.append((f'SUC {suc} - {city}', 'NOISE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append(('', 'NOISE'))
        lines.append((f'{date_str} {time_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            lines.append((f'{p["name"].upper()}  {format_price(p["price"])}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'SUBTOTAL  {format_price(subtotal)}', 'SUBTOTAL'))
        lines.append((f'TOTAL  {format_price(total if not has_tax else subtotal)}', 'TOTAL'))
        if not has_tax:
            total = subtotal
        lines.append(('', 'NOISE'))
        payment = random.choice(['EFECTIVO', 'TARJETA'])
        if payment == 'EFECTIVO':
            paid = round(total + random.randint(1, 10) * 50, 2)
            lines.append((f'EFECTIVO  {format_price(paid)}', 'PAYMENT'))
            lines.append((f'CAMBIO  {format_price(round(paid - total, 2))}', 'CHANGE'))
        else:
            lines.append((f'TARJETA  ****{random.randint(1000,9999)}', 'PAYMENT'))
        lines.append(('', 'NOISE'))
        lines.append(('*** GRACIAS ***', 'DECORATION'))

    elif template == 'department_store':
        lines.append(('=' * 30, 'DECORATION'))
        lines.append((merchant['name'].upper(), 'MERCHANT'))
        lines.append((merchant['legal'], 'NOISE'))
        lines.append((f'RFC: {merchant["rfc"]}', 'RFC_LINE'))
        lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append((f'{col}', 'ADDRESS'))
        lines.append((f'{city} C.P. {cp:05d}', 'ADDRESS'))
        lines.append(('', 'NOISE'))
        lines.append((f'FECHA: {date_str}  HORA: {time_str}', 'DATE'))
        lines.append(('=' * 30, 'DECORATION'))
        for p in products:
            ptotal = p['price'] * p['qty']
            lines.append((f'{p["name"].upper()}  {format_price(ptotal, True, True)}', 'PRODUCT'))
        lines.append(('-' * 30, 'DECORATION'))
        lines.append((f'SUBTOTAL  {format_price(subtotal, True, True)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'IVA  {format_price(tax, True, True)}', 'TAX'))
        lines.append((f'TOTAL  {format_price(total, True, True)}', 'TOTAL'))
        lines.append(('=' * 30, 'DECORATION'))
        lines.append((f'PAGO TC MASTERCARD', 'PAYMENT'))

    elif template == 'ride_hailing':
        lines.append((merchant['name'], 'MERCHANT'))
        month_names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        lines.append((f'Tu viaje del {date.day} de {month_names[date.month-1]}', 'DATE'))
        lines.append(('', 'NOISE'))
        origin = random.choice(['Polanco', 'Condesa', 'Roma', 'Centro', 'Santa Fe', 'Coyoacán', 'Del Valle'])
        dest = random.choice(['Santa Fe', 'Polanco', 'Reforma', 'Aeropuerto', 'Insurgentes', 'Chapultepec'])
        lines.append((f'De: {origin}, CDMX', 'NOISE'))
        lines.append((f'A: {dest}, CDMX', 'NOISE'))
        lines.append(('', 'NOISE'))
        base = round(random.uniform(15, 35), 2)
        dist = round(random.uniform(20, 80), 2)
        tiempo = round(random.uniform(10, 40), 2)
        peaje_val = round(random.uniform(0, 25), 2) if random.random() < 0.3 else 0
        subtotal = round(base + dist + tiempo + peaje_val, 2)
        tax = round(subtotal * 0.16, 2)
        total = round(subtotal + tax, 2)
        lines.append((f'Tarifa base  {format_price(base)}', 'PRODUCT'))
        lines.append((f'Distancia  {format_price(dist)}', 'PRODUCT'))
        lines.append((f'Tiempo  {format_price(tiempo)}', 'PRODUCT'))
        if peaje_val > 0:
            lines.append((f'Peaje  {format_price(peaje_val)}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'Subtotal  {format_price(subtotal)}', 'SUBTOTAL'))
        lines.append((f'IVA  {format_price(tax)}', 'TAX'))
        lines.append(('', 'NOISE'))
        lines.append((f'Total  {format_price(total)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        lines.append((f'Pago: Visa ****{random.randint(1000,9999)}', 'PAYMENT'))

    elif template == 'sams_costco':
        lines.append((f'**** {merchant["name"].upper()} ****', 'MERCHANT'))
        lines.append((merchant['legal'].split(' S.')[0], 'NOISE'))
        lines.append(('S.A. DE C.V.', 'NOISE'))
        lines.append((f'RFC {merchant["rfc"]}', 'RFC_LINE'))
        club_num = random.randint(1000, 9999)
        lines.append((f'CLUB {club_num} {random.choice(["INTERLOMAS", "SATELITE", "COYOACAN", "SANTA FE"])}', 'NOISE'))
        lines.append((f'{date_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            ptotal = p['price'] * p['qty']
            lines.append((f'{p["name"].upper()}  {format_price(ptotal, False, True)}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        lines.append((f'SUBTOTAL  {format_price(subtotal, True, True)}', 'SUBTOTAL'))
        if has_tax:
            lines.append((f'IVA  {format_price(tax, True, True)}', 'TAX'))
        lines.append(('', 'NOISE'))
        lines.append((f'TOTAL  {format_price(total, True, True)}', 'TOTAL'))
        lines.append(('', 'NOISE'))
        lines.append(('PAGO TC MASTERCARD', 'PAYMENT'))

    elif template == 'generic':
        lines.append((merchant['name'].upper(), 'MERCHANT'))
        if random.random() < 0.6:
            lines.append((f'RFC: {merchant["rfc"]}', 'RFC_LINE'))
        if random.random() < 0.4:
            lines.append((f'{street} {num}', 'ADDRESS'))
        lines.append((f'{date_str}', 'DATE'))
        lines.append(('', 'NOISE'))
        for p in products:
            ptotal = p['price'] * p['qty']
            lines.append((f'{p["name"]}  {format_price(ptotal)}', 'PRODUCT'))
        lines.append(('', 'NOISE'))
        if random.random() < 0.5:
            lines.append((f'Subtotal  {format_price(subtotal)}', 'SUBTOTAL'))
        if has_tax and random.random() < 0.5:
            lines.append((f'IVA  {format_price(tax)}', 'TAX'))
        total_kw = random.choice(['Total', 'TOTAL', 'Total a pagar', 'GRAN TOTAL', 'Monto total'])
        lines.append((f'{total_kw}  {format_price(total)}', 'TOTAL'))

    return {
        'lines': lines,
        'groundTruth': {
            'amount': total,
            'date': ground_truth_date,
            'merchantName': merchant['name'],
            'rfc': merchant['rfc'],
            'category': category,
        },
        'template': template,
    }


# ═══════════════════════════════════════════
# SIMULADOR DE ERRORES OCR
# ═══════════════════════════════════════════

def apply_ocr_errors(text, severity):
    """Apply OCR-like errors to text."""
    if severity == 'clean':
        return text

    result = list(text)

    if severity in ('light', 'medium', 'severe'):
        # Insert random spaces
        prob = {'light': 0.02, 'medium': 0.05, 'severe': 0.10}[severity]
        i = len(result) - 1
        while i > 0:
            if random.random() < prob and result[i] not in (' ', '\n'):
                result.insert(i, ' ')
            i -= 1

    if severity in ('medium', 'severe'):
        # Character substitutions
        subs = {'O': '0', '0': 'O', 'l': '1', '1': 'l', 'I': '1',
                'S': '5', '5': 'S', 'B': '8', 'A': '4', 'a': '@',
                'e': 'c', 'G': '6', 'T': '7'}
        prob = {'medium': 0.03, 'severe': 0.08}[severity]
        for i in range(len(result)):
            if random.random() < prob and result[i] in subs:
                result[i] = subs[result[i]]

    if severity == 'severe':
        # Drop some characters
        result = [c for c in result if random.random() > 0.02]

    # Spaces around decimal points (common OCR error)
    if severity in ('light', 'medium', 'severe'):
        text_out = ''.join(result)
        if random.random() < {'light': 0.1, 'medium': 0.2, 'severe': 0.4}[severity]:
            # "$21.50" -> "$21 .50"
            import re
            def add_space_decimal(m):
                if random.random() < 0.3:
                    return m.group(1) + ' .' + m.group(2)
                return m.group(0)
            text_out = re.sub(r'(\d)\.(\d)', add_space_decimal, text_out)
        return text_out

    return ''.join(result)


def choose_severity():
    r = random.random()
    if r < 0.30:
        return 'clean'
    elif r < 0.70:
        return 'light'
    elif r < 0.90:
        return 'medium'
    else:
        return 'severe'


# ═══════════════════════════════════════════
# GENERADOR PRINCIPAL
# ═══════════════════════════════════════════

TEMPLATES = [
    'oxxo', 'walmart', 'restaurant', 'gas_station', 'coffee_shop',
    'pharmacy', 'department_store', 'ride_hailing', 'sams_costco', 'generic',
]


def generate_receipt(idx):
    """Generate a single receipt with ground truth."""
    # Pick category and merchant
    category = random.choice(list(MERCHANTS.keys()))
    merchant = random.choice(MERCHANTS[category])

    # Pick template (some templates make more sense for certain categories)
    if category == 'Transporte' and random.random() < 0.5:
        template = random.choice(['gas_station', 'ride_hailing'])
    elif category == 'Salud' and random.random() < 0.4:
        template = 'pharmacy'
    elif merchant['name'] in ('OXXO', '7-Eleven', 'Circle K') and random.random() < 0.5:
        template = 'oxxo'
    elif merchant['name'] in ('Walmart', 'Soriana', 'Chedraui', 'HEB', 'La Comer', 'Bodega Aurrera') and random.random() < 0.5:
        template = 'walmart'
    elif merchant['name'] in ("Sam's Club", 'Costco') and random.random() < 0.6:
        template = 'sams_costco'
    elif merchant['name'] in ('Starbucks', 'El Péndulo', 'Cielito Querido Café', 'Punta del Cielo') and random.random() < 0.5:
        template = 'coffee_shop'
    elif merchant['name'] in ('Liverpool', 'Palacio de Hierro', 'Sears', 'Coppel') and random.random() < 0.5:
        template = 'department_store'
    elif merchant['name'] in ('Uber', 'DiDi', 'Cabify', 'Beat', 'InDriver') and random.random() < 0.7:
        template = 'ride_hailing'
    elif merchant['name'] in ('Farmacia Guadalajara', 'Farmacias del Ahorro', 'Farmacias Similares', 'Farmacia San Pablo', 'Benavides') and random.random() < 0.5:
        template = 'pharmacy'
    elif category == 'Comida' and random.random() < 0.4:
        template = 'restaurant'
    else:
        template = random.choice(TEMPLATES)

    receipt_data = build_receipt(template, merchant, category)

    # Apply OCR errors
    severity = choose_severity()
    line_labels = []
    ocr_lines = []

    for text, line_type in receipt_data['lines']:
        if not text:
            ocr_lines.append('')
            line_labels.append({'text': '', 'type': 'NOISE'})
            continue

        ocr_text = apply_ocr_errors(text, severity)
        ocr_lines.append(ocr_text)
        line_labels.append({'text': ocr_text, 'type': line_type})

    ocr_text = '\n'.join(ocr_lines)

    return {
        'id': idx,
        'ocrText': ocr_text,
        'lineLabels': line_labels,
        'groundTruth': receipt_data['groundTruth'],
        'template': receipt_data['template'],
        'severity': severity,
    }


def main():
    receipts = []
    for i in range(1000):
        receipt = generate_receipt(i)
        receipts.append(receipt)

    # Stats
    templates_count = {}
    severity_count = {}
    category_count = {}
    for r in receipts:
        templates_count[r['template']] = templates_count.get(r['template'], 0) + 1
        severity_count[r['severity']] = severity_count.get(r['severity'], 0) + 1
        category_count[r['groundTruth']['category']] = category_count.get(r['groundTruth']['category'], 0) + 1

    print(f'Generated {len(receipts)} receipts')
    print(f'\nTemplates: {json.dumps(templates_count, indent=2)}')
    print(f'\nSeverity: {json.dumps(severity_count, indent=2)}')
    print(f'\nCategories: {json.dumps(category_count, indent=2)}')

    total_lines = sum(len(r['lineLabels']) for r in receipts)
    label_counts = {}
    for r in receipts:
        for ll in r['lineLabels']:
            t = ll['type']
            label_counts[t] = label_counts.get(t, 0) + 1
    print(f'\nTotal lines: {total_lines}')
    print(f'Line type distribution: {json.dumps(label_counts, indent=2)}')

    # Save
    out_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'receipts.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(receipts, f, ensure_ascii=False, indent=2)
    print(f'\nSaved to {out_path}')

    # Also save 100 for testing
    test_receipts = random.sample(receipts, 100)
    test_path = os.path.join(out_dir, 'test_receipts_100.json')
    with open(test_path, 'w', encoding='utf-8') as f:
        json.dump(test_receipts, f, ensure_ascii=False, indent=2)
    print(f'Test set saved to {test_path}')


if __name__ == '__main__':
    main()
