import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white selection:bg-[#6366F1] selection:text-white font-sans flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <Hero />
        {/* Aquí podrías agregar en el futuro secciones como <Features /> o <Pricing /> */}
      </main>

      <Footer />
    </div>
  );
}