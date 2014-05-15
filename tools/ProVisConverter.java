import com.mindfusion.diagramming.Base64;
import com.mindfusion.diagramming.Diagram;
import com.mindfusion.diagramming.DiagramView;
import com.mindfusion.diagramming.ProVisConfig;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.lang.StringBuilder;
import java.net.URL;
import java.net.URLConnection;
import java.net.MalformedURLException;
import java.util.Scanner;
import org.xml.sax.InputSource;
import sun.misc.BASE64Encoder;

public class ProVisConverter {
  private String baseUrl;
  private String macroUrl;
  private String configUrl;
  private String authHeader;


  public ProVisConverter( String config, String base, String authHeader ) {
    this.authHeader = authHeader;
    baseUrl = base;
    macroUrl = base + "/bin/rest/RenderPlugin/expand?text=%SOLRSEARCH{%22type:%20aqm%22%20format=%22$url%22%20rows=%221000%22%20separator=%22,%22}%";
    configUrl = base + "/bin/rest/RenderPlugin/expand?text=%INCLUDE{%22" + config + "%22%20section=%22PROVISCONFIG%22%20warn=%22off%22}%";
  }

  public void test() {
    String response = getResponseText( macroUrl );
    if ( response != null && response.trim().equals( "" ) )
      return;

    String json = getResponseText( configUrl );
    ProVisConfig.loadJson( json );

    String[] aqms = response.split( "," );
    for ( String aqm : aqms ) {
      String content = getResponseText( baseUrl + aqm );
      if ( content == null ) {
        System.out.printf( "%-10s%s%n", "IO_ERR", aqm );
        continue;
      }

      Diagram d = new Diagram();
      d.loadFromString( content );

      int ic = d.getItems().size();
      boolean converted = d.findNode( "whitepaper" ) == null && ic > 0;
      if ( converted ) {
        System.out.printf( "%-10s%s%n", "SKIPPED", aqm );
        continue;
      }

      boolean success = true;
      try {
        d.convert();
      } catch( Exception e ) {
        success = false;
        e.printStackTrace();
      }

      System.out.printf( "%-10s%s%n", success ? "OK" : "ERROR", aqm );
    }
  }

  private String getResponseText( String uri ) {
    StringBuilder sb = new StringBuilder();
    InputStream stream = null;

    try {
      String line;
      URL url = new URL( uri );
      URLConnection con = url.openConnection();

      if ( authHeader != null ) {
        con.setRequestProperty( "Authorization", authHeader );
      }

      stream = con.getInputStream();
      BufferedReader br = new BufferedReader( new InputStreamReader( stream, "UTF-8" ) );
      while ( (line = br.readLine()) != null ) {
        sb.append( line );
      }
    } catch ( MalformedURLException ex ) {
      ex.printStackTrace();
      System.exit( 1 );
    } catch ( IOException ex ) {
      ex.printStackTrace();
      System.exit( 1 );
    } finally {
      try {
        if ( stream != null )
          stream.close();
      } catch ( IOException ex ) {}
    }

    return sb.toString().replace( "\n", "" );
  }

  public static void main( String[] args ) {
    if ( args.length < 4 || args.length > 5 ) {
      printUsage();
      return;
    }

    String url = null, cfg = null, authHeader = null;
    try {
      for ( int i = 0; i < args.length; ++i ) {
        switch( args[i] ) {
          case "-auth":
            String usr = null, pw = null;
            Scanner in = new Scanner( System.in );
            System.out.print( "Username: " );
            usr = in.next();
            System.out.print( "Password: " );
            pw = in.next();
            in.close();
            byte[] data = (usr + ":" + pw).getBytes();
            String b64 = new sun.misc.BASE64Encoder().encode( data );
            authHeader = "Basic " + b64;
            break;
          case "-cfg":
            cfg = args[i+1];
            break;
          case "-url":
            url = args[i+1];
            break;
        }
      }
    } catch( Exception ex ) {
      ex.printStackTrace();
      System.out.println();
      printUsage();

      return;
    }

    if ( url == null || cfg == null ) {
      printUsage();
      return;
    }

    ProVisConverter c = new ProVisConverter( cfg, url, authHeader );
    c.test();
  }

  private static void printUsage() {
    StringBuilder sb = new StringBuilder();
    sb.append( "Usage:\n" );
    sb.append( "  -url WIKI_URL\n" );
    sb.append( "  -cfg Web.Topic\n" );
    sb.append( "  -auth\n" );
    sb.append( "    e.g java ProVisConverter -url http://qwiki.example.com -cfg System.ProVisDesignerPlugin\n" );
    sb.append( "        java ProVisConverter -auth -url http://qwiki.example.com -cfg System.ProVisDesignerPlugin\n" );
    System.out.println( sb );
  }
}
